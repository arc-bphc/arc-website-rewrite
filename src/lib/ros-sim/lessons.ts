/**
 * The teaching sequence.
 *
 * Each lesson unlocks one block and ends in a check the student can only pass
 * by running their graph. Checks read a rolling summary of the run rather than
 * an instantaneous snapshot, so a challenge stays passed even after the robot
 * drives past the goal.
 */

import type { BlockKind, Program } from './program';
import { publishedTopics, subscribedTopics, walk } from './program';
import type { Arena } from './Robot';
import { CMD_VEL, SCAN } from './types';

/** Everything a check is allowed to look at. */
export interface RunSummary {
	program: Program;
	/** Simulation seconds since the last reset. */
	time: number;
	/** Metres travelled since the last reset. */
	distance: number;
	collided: boolean;
	reachedGoal: boolean;
	/** Topics that carried at least one message during this run. */
	topicsSeen: Set<string>;
	/** True once a log block has produced a line this run. */
	logged: boolean;
}

export interface Lesson {
	id: string;
	title: string;
	/** One line of theory. Kept to one line on purpose. */
	concept: string;
	/** What to do, in the fewest words that still work. */
	brief: string[];
	/** The pass condition, phrased as a challenge. */
	goal: string;
	arena: Arena;
	/** Blocks this lesson introduces; the palette shows every block up to here. */
	unlocks: BlockKind[];
	check: (run: RunSummary) => boolean;
}

const OPEN: Arena = {
	width: 14,
	height: 9,
	obstacles: [],
	goal: { x: 11.6, y: 3.4, w: 1.8, h: 2.2 },
	start: { x: 2, y: 4.5, theta: 0 },
};

const WALL: Arena = {
	width: 14,
	height: 9,
	obstacles: [{ x: 7.4, y: 1.6, w: 0.7, h: 5.8 }],
	goal: { x: 11.6, y: 3.4, w: 1.8, h: 2.2 },
	start: { x: 2, y: 4.5, theta: 0 },
};

const COURSE: Arena = {
	width: 14,
	height: 9,
	obstacles: [
		{ x: 4.2, y: 0, w: 0.7, h: 5.4 },
		{ x: 7.6, y: 3.6, w: 0.7, h: 5.4 },
		{ x: 10.4, y: 0, w: 0.7, h: 4.6 },
	],
	goal: { x: 12.1, y: 6.2, w: 1.6, h: 2.2 },
	start: { x: 1.6, y: 4.5, theta: 0 },
};

const publishesTo = (program: Program, topic: string) =>
	program.nodes.some((node) => publishedTopics(node).includes(topic));

const subscribesTo = (program: Program, topic: string) =>
	program.nodes.some((node) => subscribedTopics(node).includes(topic));

function hasBlock(program: Program, kind: BlockKind): boolean {
	let found = false;
	for (const node of program.nodes) {
		walk(node.body, (stmt) => {
			if (stmt.kind === kind) found = true;
		});
	}
	return found;
}

export const LESSONS: Lesson[] = [
	{
		id: 'nodes',
		title: 'Nodes',
		concept: 'A node is one running program. A robot is many nodes talking to each other.',
		brief: ['Drag a Node block onto the workspace.', 'Give it a name you would recognise.'],
		goal: 'Have one node in your graph.',
		arena: OPEN,
		unlocks: [],
		check: (run) => run.program.nodes.length >= 1,
	},
	{
		id: 'topics',
		title: 'Topics & publishers',
		concept: 'A topic is a named channel. A publisher is a node asking to write to it.',
		brief: [
			'Drop a Publisher block into your node.',
			`Set its topic to ${CMD_VEL}.`,
			'Watch the topic appear in the graph.',
		],
		goal: `Publish a publisher on ${CMD_VEL}.`,
		arena: OPEN,
		unlocks: ['publisher'],
		check: (run) => publishesTo(run.program, CMD_VEL),
	},
	{
		id: 'messages',
		title: 'Messages',
		concept: 'A message is the data itself. On /cmd_vel it is a Twist: how fast, how sharply.',
		brief: [
			'Drop a Publish block into your node.',
			'Leave linear at 0 for now.',
			'Press Run and watch a packet travel down the wire.',
		],
		goal: `Send at least one message on ${CMD_VEL}.`,
		arena: OPEN,
		unlocks: ['publish'],
		check: (run) => run.topicsSeen.has(CMD_VEL),
	},
	{
		id: 'subscribers',
		title: 'Subscribers',
		concept: 'A subscriber listens. The publisher never learns who — that is the whole trick.',
		brief: [
			'Add a second node.',
			`Give it a Subscriber on ${SCAN}.`,
			'Add a Log block reading scan.front and press Run.',
		],
		goal: `Subscribe to ${SCAN} and log a value from it.`,
		arena: OPEN,
		unlocks: ['subscriber', 'log'],
		check: (run) => subscribesTo(run.program, SCAN) && run.logged && run.topicsSeen.has(SCAN),
	},
	{
		id: 'drive',
		title: 'Driving',
		concept: 'The robot is a node too. It subscribes /cmd_vel and does what the Twist says.',
		brief: [
			'Set linear on your Publish block to about 0.6.',
			'Press Run.',
			'angular turns; linear drives.',
		],
		goal: 'Drive 3 metres.',
		arena: OPEN,
		unlocks: [],
		check: (run) => run.distance >= 3,
	},
	{
		id: 'sensing',
		title: 'Sensing',
		concept: '/scan reports how far away things are. Reading it is how a robot decides anything.',
		brief: [
			'Subscribe your driving node to /scan.',
			'Drop an If block: if scan.front < 1, publish angular instead of linear.',
			'There is a wall ahead now.',
		],
		goal: 'Drive 4 metres over 12 seconds without hitting anything.',
		arena: WALL,
		unlocks: ['if'],
		check: (run) => run.distance >= 4 && run.time >= 12 && !run.collided,
	},
	{
		id: 'course',
		title: 'The course',
		concept: 'Sense, decide, act. Every autonomous robot you will ever build is this loop.',
		brief: [
			'Three walls, no map, no instructions.',
			'Your node only knows what /scan tells it.',
			'Nothing new to learn — just put it together.',
		],
		// Reaching the flag needs the robot to know where the flag *is*, and /scan
		// cannot tell it that. Surviving the course is what this block set can
		// genuinely express, so that is what is asked; the flag stays as a bonus
		// for anyone who gets lucky or clever.
		goal: 'Drive 15 metres through the course without hitting anything. (Flag = bonus.)',
		arena: COURSE,
		unlocks: [],
		check: (run) => run.reachedGoal || (run.distance >= 15 && !run.collided),
	},
];

export const SANDBOX: Lesson = {
	id: 'sandbox',
	title: 'Sandbox',
	concept: 'Every block unlocked, no goal. Build whatever you want.',
	brief: ['All blocks are available.', 'The course is still here if you want it.'],
	goal: 'None — go play.',
	arena: COURSE,
	unlocks: ['publisher', 'subscriber', 'publish', 'log', 'if'],
	check: () => false,
};

/** Blocks available at a given lesson: everything unlocked up to and including it. */
export function unlockedBlocks(lessonIndex: number): Set<BlockKind> {
	if (lessonIndex >= LESSONS.length) return new Set(SANDBOX.unlocks);
	const unlocked = new Set<BlockKind>();
	for (let i = 0; i <= lessonIndex && i < LESSONS.length; i += 1) {
		for (const kind of LESSONS[i].unlocks) unlocked.add(kind);
	}
	return unlocked;
}

export function lessonAt(index: number): Lesson {
	return LESSONS[index] ?? SANDBOX;
}

/** Deliberately unused by `check`; exposed so the UI can show what a lesson expects. */
export const hasBlockOfKind = hasBlock;
