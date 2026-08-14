/**
 * The clock and the executor.
 *
 * Runs a fixed-step loop on the main thread. At the sizes this workshop deals
 * with — a handful of nodes and one robot — a Web Worker would buy nothing but
 * a message-passing boundary, so the loop stays here until profiling says
 * otherwise. React never re-renders from this loop: views that need per-frame
 * data read the mutable state directly, and everything else arrives as a
 * discrete event.
 */

import { runBody, type ExecContext } from './interpreter';
import type { Program, ProgramNode } from './program';
import { publishedTopics, subscribedTopics } from './program';
import { type Arena, Robot } from './Robot';
import { MessageBus } from './MessageBus';
import { CMD_VEL, ROBOT_NODE, SCAN, type MessagePayload, type ROSMessage, type Twist } from './types';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'topic';

export interface LogLine {
	id: number;
	level: LogLevel;
	text: string;
	/** Simulation time in seconds. */
	time: number;
}

export interface SimEvents {
	log: LogLine;
	message: ROSMessage;
	/** Running/paused/reset transitions, so the toolbar can re-render. */
	state: { running: boolean };
	goal: { time: number };
}

type Listener<K extends keyof SimEvents> = (payload: SimEvents[K]) => void;

/** Simulation steps per second. Independent of display refresh rate. */
const TICK_HZ = 50;
const TICK_DT = 1 / TICK_HZ;
/** How often the robot publishes /scan. */
const SCAN_HZ = 10;
/** Guards against a backgrounded tab trying to catch up on minutes of time. */
const MAX_STEPS_PER_FRAME = 5;

interface NodeRuntime {
	def: ProgramNode;
	inbox: Map<string, ROSMessage>;
	/** Seconds owed to this node's timer. */
	accumulator: number;
	unsubscribes: (() => void)[];
	warned: Set<string>;
}

export class Simulation {
	readonly bus = new MessageBus();
	readonly robot: Robot;

	running = false;
	time = 0;

	/**
	 * Rolling facts about the current run, cleared on reset. Challenge checks read
	 * these rather than an instantaneous snapshot, so a lesson stays passed after
	 * the robot has driven on past the moment that satisfied it.
	 */
	everCollided = false;
	topicsSeen = new Set<string>();
	userLogCount = 0;

	private program: Program = { nodes: [] };
	private runtimes: NodeRuntime[] = [];
	private listeners: { [K in keyof SimEvents]?: Listener<K>[] } = {};
	private rafId: number | null = null;
	private lastFrame = 0;
	private carry = 0;
	private scanAccumulator = 0;
	private logSeq = 0;
	private lastCollisionLog = -1;
	private goalAnnounced = false;
	private robotUnsubscribe: (() => void) | null = null;

	constructor(arena: Arena) {
		this.robot = new Robot(arena);
	}

	// ---------------------------------------------------------------- events

	on<K extends keyof SimEvents>(event: K, fn: Listener<K>): () => void {
		if (!this.listeners[event]) this.listeners[event] = [];
		const list = this.listeners[event] as Listener<K>[];
		list.push(fn);
		return () => {
			const current = this.listeners[event] as Listener<K>[] | undefined;
			if (!current) return;
			const index = current.indexOf(fn);
			if (index !== -1) current.splice(index, 1);
		};
	}

	private emit<K extends keyof SimEvents>(event: K, payload: SimEvents[K]): void {
		const list = this.listeners[event] as Listener<K>[] | undefined;
		if (!list) return;
		for (const fn of [...list]) fn(payload);
	}

	log(level: LogLevel, text: string): void {
		this.logSeq += 1;
		this.emit('log', { id: this.logSeq, level, text, time: this.time });
	}

	// ----------------------------------------------------------- lifecycle

	/**
	 * Rebuilds the runtime from a program. Called on every edit, so it has to be
	 * cheap and has to preserve nothing — a student changing a topic name expects
	 * the old wiring to disappear immediately.
	 */
	load(program: Program): void {
		this.program = program;
		this.teardownRuntimes();

		this.runtimes = program.nodes.map((def) => {
			const runtime: NodeRuntime = {
				def,
				inbox: new Map(),
				accumulator: 0,
				unsubscribes: [],
				warned: new Set(),
			};

			for (const topic of subscribedTopics(def)) {
				runtime.unsubscribes.push(
					this.bus.subscribe(def.id, topic, (message) => {
						runtime.inbox.set(topic, message);
					}),
				);
			}

			return runtime;
		});

		this.wireRobot();
	}

	setArena(arena: Arena): void {
		this.robot.setArena(arena);
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.lastFrame = performance.now();
		this.carry = 0;
		this.emit('state', { running: true });
		this.log('success', 'simulation started');
		this.loop();
	}

	pause(): void {
		if (!this.running) return;
		this.running = false;
		if (this.rafId !== null) cancelAnimationFrame(this.rafId);
		this.rafId = null;
		this.emit('state', { running: false });
		this.log('info', 'simulation paused');
	}

	reset(): void {
		this.pause();
		this.time = 0;
		this.carry = 0;
		this.scanAccumulator = 0;
		this.lastCollisionLog = -1;
		this.goalAnnounced = false;
		this.everCollided = false;
		this.topicsSeen.clear();
		this.userLogCount = 0;
		this.robot.reset();
		for (const runtime of this.runtimes) {
			runtime.inbox.clear();
			runtime.accumulator = 0;
			runtime.warned.clear();
		}
		this.emit('state', { running: false });
		this.log('info', 'simulation reset');
	}

	/**
	 * Runs the simulation forward without a display, in the same fixed steps the
	 * animation loop uses. Lets the course be checked for solvability off-browser,
	 * and keeps that check honest by exercising the real executor.
	 */
	advance(seconds: number): void {
		const steps = Math.round(seconds / TICK_DT);
		for (let i = 0; i < steps; i += 1) this.step(TICK_DT);
	}

	/** Releases every timer and listener. Must be called when the island unmounts. */
	dispose(): void {
		this.pause();
		this.teardownRuntimes();
		this.robotUnsubscribe?.();
		this.robotUnsubscribe = null;
		this.bus.reset();
		this.listeners = {};
	}

	private teardownRuntimes(): void {
		for (const runtime of this.runtimes) {
			for (const unsubscribe of runtime.unsubscribes) unsubscribe();
		}
		this.runtimes = [];
	}

	/** The robot is a node like any other: it subscribes /cmd_vel, publishes /scan. */
	private wireRobot(): void {
		this.robotUnsubscribe?.();
		this.robotUnsubscribe = this.bus.subscribe(ROBOT_NODE, CMD_VEL, (message) => {
			this.robot.command(message.payload as Twist);
		});
	}

	// ---------------------------------------------------------------- loop

	private loop = (): void => {
		if (!this.running) return;

		const now = performance.now();
		const elapsed = Math.min((now - this.lastFrame) / 1000, 0.25);
		this.lastFrame = now;
		this.carry += elapsed;

		let steps = 0;
		while (this.carry >= TICK_DT && steps < MAX_STEPS_PER_FRAME) {
			this.step(TICK_DT);
			this.carry -= TICK_DT;
			steps += 1;
		}
		// Whatever is left over after the cap is dropped rather than banked, so a
		// tab returning from the background does not fast-forward the robot.
		if (steps === MAX_STEPS_PER_FRAME) this.carry = 0;

		this.rafId = requestAnimationFrame(this.loop);
	};

	private step(dt: number): void {
		this.time += dt;

		this.scanAccumulator += dt;
		const scanPeriod = 1 / SCAN_HZ;
		if (this.scanAccumulator >= scanPeriod) {
			this.scanAccumulator -= scanPeriod;
			this.publishFrom(ROBOT_NODE, SCAN, cloneScan(this.robot.scan));
		}

		for (const runtime of this.runtimes) {
			const period = 1 / Math.max(0.5, runtime.def.rateHz);
			runtime.accumulator += dt;
			if (runtime.accumulator < period) continue;
			// Collapse any backlog: a 1 Hz node should not fire ten times because
			// the tab stalled. One callback per wake-up is the honest model.
			runtime.accumulator = 0;
			this.runNode(runtime);
		}

		this.robot.step(dt);

		if (this.robot.collided) {
			this.everCollided = true;
			if (this.time - this.lastCollisionLog > 1) {
				this.lastCollisionLog = this.time;
				this.log('error', 'robot hit an obstacle');
			}
		}

		if (this.robot.reachedGoal && !this.goalAnnounced) {
			this.goalAnnounced = true;
			this.log('success', `goal reached at t=${this.time.toFixed(1)}s`);
			this.emit('goal', { time: this.time });
		}
	}

	private runNode(runtime: NodeRuntime): void {
		const declared = new Set(publishedTopics(runtime.def));

		const ctx: ExecContext = {
			nodeId: runtime.def.id,
			nodeName: runtime.def.name,
			inbox: runtime.inbox,
			publish: (topic, payload) => {
				if (!declared.has(topic)) {
					// Refused rather than silently delivered: the Publisher block is
					// what makes the topic exist, and a student needs to feel that.
					this.warnOnce(
						runtime,
						`publisher:${topic}`,
						`${runtime.def.name} tried to publish on ${topic} without a publisher`,
					);
					return;
				}
				this.publishFrom(runtime.def.id, topic, payload);
			},
			log: (text) => {
				this.userLogCount += 1;
				this.log('info', `[${runtime.def.name}] ${text}`);
			},
			warn: (text) => this.warnOnce(runtime, text, text),
		};

		runBody(runtime.def.body, ctx);
	}

	private publishFrom(nodeId: string, topic: string, payload: MessagePayload): void {
		this.topicsSeen.add(topic);
		const message = this.bus.publish(nodeId, topic, payload, this.time);
		this.emit('message', message);
	}

	private warnOnce(runtime: NodeRuntime, key: string, text: string): void {
		if (runtime.warned.has(key)) return;
		runtime.warned.add(key);
		this.log('warn', text);
	}

	/** Everything a challenge check is allowed to see. */
	get snapshot() {
		return {
			program: this.program,
			time: this.time,
			distance: this.robot.distance,
			collided: this.everCollided,
			reachedGoal: this.robot.reachedGoal,
			topicsSeen: this.topicsSeen,
			logged: this.userLogCount > 0,
		};
	}
}

/** The robot mutates its scan in place; subscribers must not see it change under them. */
function cloneScan(scan: { ranges: number[]; angles: number[]; range: number }) {
	return { ranges: [...scan.ranges], angles: [...scan.angles], range: scan.range };
}
