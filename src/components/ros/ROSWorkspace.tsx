import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { buildGraph } from '../../lib/ros-sim/graph';
import { LESSONS, lessonAt, unlockedBlocks } from '../../lib/ros-sim/lessons';
import {
	type Declaration,
	type Program,
	type Statement,
	allTopics,
	containsStatement,
	insertStatement,
	locateStatement,
	newIfBlock,
	newLogBlock,
	newNode,
	newPublishBlock,
	newPublisherDecl,
	newSubscriberDecl,
	removeStatement,
	updateStatement,
} from '../../lib/ros-sim/program';
import { Simulation } from '../../lib/ros-sim/Simulation';
import BlockPalette from './BlockPalette';
import ConsoleView from './ConsoleView';
import { DRAG_THRESHOLD, type DragPayload, type DropTarget, resolveTarget } from './dnd';
import GraphView from './GraphView';
import LessonPanel from './LessonPanel';
import NodeCard from './NodeCard';
import RobotView from './RobotView';
import { ACCENT, type BlockContext } from './StatementView';
import './ros.css';

const STORAGE_KEY = 'arc-ros-workshop-v1';
/** How often challenge checks run. Fast enough to feel instant, slow enough to be free. */
const CHECK_MS = 300;
/** Beat between a challenge passing and the next lesson loading, so the ✓ registers. */
const ADVANCE_MS = 1500;

interface Saved {
	version: 1;
	program: Program;
	lessonIndex: number;
	completed: string[];
}

const MemoGraph = memo(GraphView);
const MemoRobot = memo(RobotView);
const MemoConsole = memo(ConsoleView);

export default function ROSWorkspace() {
	const [program, setProgram] = useState<Program>({ nodes: [] });
	const [lessonIndex, setLessonIndex] = useState(0);
	const [completed, setCompleted] = useState<Set<string>>(new Set());
	const [running, setRunning] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const [restored, setRestored] = useState(false);
	/** Lesson index waiting to be stepped past, set only by a fresh challenge pass. */
	const [pendingAdvance, setPendingAdvance] = useState<number | null>(null);

	// Drag: the payload and the resolved target live in React because they change
	// the rendered tree; the pointer position does not, and is applied straight to
	// the ghost's transform so a drag costs one render per target change.
	const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
	const dropTargetRef = useRef<DropTarget | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);
	// Latest pointer position, kept outside React so moving the ghost costs no
	// render. The ghost mounts one render after the drag starts, so it reads this
	// on attach rather than waiting for the next pointermove and flashing at 0,0.
	const ghostPos = useRef({ x: 0, y: 0, width: 0 });

	const placeGhost = useCallback((element: HTMLDivElement | null) => {
		ghostRef.current = element;
		if (!element) return;
		const { x, y, width } = ghostPos.current;
		element.style.width = `${width}px`;
		element.style.transform = `translate(${x}px, ${y}px)`;
	}, []);

	const simRef = useRef<Simulation | null>(null);
	if (simRef.current === null) simRef.current = new Simulation(lessonAt(0).arena);
	const sim = simRef.current;

	const lesson = lessonAt(lessonIndex);
	const unlocked = useMemo(() => unlockedBlocks(lessonIndex), [lessonIndex]);
	const graph = useMemo(() => buildGraph(program), [program]);
	const knownTopics = useMemo(() => allTopics(program), [program]);

	// --------------------------------------------------------------- storage

	useEffect(() => {
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const saved = JSON.parse(raw) as Saved;
				if (saved.version === 1) {
					setProgram(saved.program);
					setLessonIndex(saved.lessonIndex);
					setCompleted(new Set(saved.completed));
				}
			}
		} catch {
			// A corrupt or blocked store is not worth interrupting a workshop for.
		}
		setRestored(true);
	}, []);

	useEffect(() => {
		if (!restored) return;
		const saved: Saved = { version: 1, program, lessonIndex, completed: [...completed] };
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
		} catch {
			// Private browsing, quota, or a locked-down lab machine. Not fatal.
		}
	}, [restored, program, lessonIndex, completed]);

	// ------------------------------------------------------------ simulation

	useEffect(() => sim.on('state', (event) => setRunning(event.running)), [sim]);

	useEffect(() => {
		sim.load(program);
	}, [sim, program]);

	useEffect(() => {
		sim.setArena(lesson.arena);
		sim.reset();
	}, [sim, lesson.arena]);

	useEffect(() => () => sim.dispose(), [sim]);

	// Challenge checking. Polled rather than pushed: some checks read the program
	// (which changes on edit) and some read the run (which changes on tick), and
	// one cheap interval covers both without wiring either.
	useEffect(() => {
		if (completed.has(lesson.id)) return;

		const timer = window.setInterval(() => {
			if (!lesson.check(sim.snapshot)) return;
			window.clearInterval(timer);
			setCompleted((current) => new Set(current).add(lesson.id));
			setToast(`${lesson.title} — challenge passed`);
			sim.log('success', `challenge passed: ${lesson.goal}`);
			// Only a first pass queues the advance. This effect bails on lessons
			// already in `completed`, so replaying an old one never drags the
			// student forward again.
			setPendingAdvance(lessonIndex);
		}, CHECK_MS);

		return () => window.clearInterval(timer);
	}, [sim, lesson, completed, lessonIndex]);

	// Passing a challenge moves the student on. Held for a beat so the ✓ and the
	// toast land before the panel changes underneath them, and guarded on their
	// still being where they passed — clicking to another lesson in that window
	// means they chose it, so it stands.
	useEffect(() => {
		if (pendingAdvance === null) return;

		const timer = window.setTimeout(() => {
			setLessonIndex((current) =>
				current === pendingAdvance ? Math.min(current + 1, LESSONS.length) : current,
			);
			setPendingAdvance(null);
		}, ADVANCE_MS);

		return () => window.clearTimeout(timer);
	}, [pendingAdvance]);

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2600);
		return () => window.clearTimeout(timer);
	}, [toast]);

	// ------------------------------------------------------------ program ops

	const patchStatement = useCallback((id: string, patch: (stmt: Statement) => Statement) => {
		setProgram((current) => ({
			nodes: current.nodes.map((node) => ({ ...node, body: updateStatement(node.body, id, patch) })),
		}));
	}, []);

	const commitDrop = useCallback((payload: DragPayload, target: DropTarget | null) => {
		if (!target) return;

		setProgram((current) => {
			const nodes = [...current.nodes];
			const nodeIndex = (id: string) => nodes.findIndex((node) => node.id === id);

			// --- deletions -----------------------------------------------------
			if (target.type === 'trash') {
				if (payload.type === 'move-stmt') {
					const index = nodeIndex(payload.nodeId);
					if (index === -1) return current;
					nodes[index] = {
						...nodes[index],
						body: removeStatement(nodes[index].body, payload.stmt.id),
					};
					return { nodes };
				}
				if (payload.type === 'move-decl') {
					const index = nodeIndex(payload.nodeId);
					if (index === -1) return current;
					nodes[index] = {
						...nodes[index],
						declarations: nodes[index].declarations.filter((d) => d.id !== payload.decl.id),
					};
					return { nodes };
				}
				return current;
			}

			// --- new node ------------------------------------------------------
			if (target.type === 'canvas' && payload.type === 'new-node') {
				const name = `node_${current.nodes.length + 1}`;
				nodes.push(newNode(name, Math.max(4, target.x - 60), Math.max(4, target.y - 12)));
				return { nodes };
			}

			// --- declarations --------------------------------------------------
			if (target.type === 'decls') {
				const index = nodeIndex(target.nodeId);
				if (index === -1) return current;

				let decl: Declaration | null = null;
				if (payload.type === 'new-decl') {
					decl = payload.kind === 'publisher' ? newPublisherDecl() : newSubscriberDecl();
				} else if (payload.type === 'move-decl') {
					if (payload.nodeId === target.nodeId) return current;
					const source = nodeIndex(payload.nodeId);
					if (source === -1) return current;
					nodes[source] = {
						...nodes[source],
						declarations: nodes[source].declarations.filter((d) => d.id !== payload.decl.id),
					};
					decl = payload.decl;
				}
				if (!decl) return current;

				nodes[index] = { ...nodes[index], declarations: [...nodes[index].declarations, decl] };
				return { nodes };
			}

			// --- statements ----------------------------------------------------
			if (target.type === 'stack') {
				const index = nodeIndex(target.nodeId);
				if (index === -1) return current;

				if (payload.type === 'new-stmt') {
					const stmt =
						payload.kind === 'publish'
							? newPublishBlock()
							: payload.kind === 'log'
								? newLogBlock()
								: newIfBlock();
					nodes[index] = {
						...nodes[index],
						body: insertStatement(nodes[index].body, target.parentId, target.index, stmt),
					};
					return { nodes };
				}

				if (payload.type === 'move-stmt') {
					// An if-block cannot be dropped inside itself; the drag is simply
					// abandoned rather than producing an unreachable subtree.
					if (target.parentId && containsStatement(payload.stmt, target.parentId)) return current;

					const source = nodeIndex(payload.nodeId);
					if (source === -1) return current;

					const origin = locateStatement(nodes[source].body, payload.stmt.id);
					let insertAt = target.index;
					// Removing the block first shifts every later index in the same
					// container down by one.
					if (
						origin &&
						payload.nodeId === target.nodeId &&
						origin.parentId === target.parentId &&
						origin.index < target.index
					) {
						insertAt -= 1;
					}

					nodes[source] = {
						...nodes[source],
						body: removeStatement(nodes[source].body, payload.stmt.id),
					};
					const destination = nodeIndex(target.nodeId);
					nodes[destination] = {
						...nodes[destination],
						body: insertStatement(
							nodes[destination].body,
							target.parentId,
							insertAt,
							payload.stmt,
						),
					};
					return { nodes };
				}
			}

			return current;
		});
	}, []);

	// ------------------------------------------------------------------ drag

	const beginDrag = useCallback((payload: DragPayload, event: ReactPointerEvent) => {
		if (event.button !== 0) return;
		// Typing in a block must not start a drag.
		if ((event.target as HTMLElement).closest('input, select, textarea, button')) return;

		const source = event.currentTarget as HTMLElement;
		const rect = source.getBoundingClientRect();
		const startX = event.clientX;
		const startY = event.clientY;
		const dx = startX - rect.left;
		const dy = startY - rect.top;
		let started = false;

		const move = (moveEvent: PointerEvent) => {
			ghostPos.current = {
				x: moveEvent.clientX - dx,
				y: moveEvent.clientY - dy,
				width: rect.width,
			};

			if (!started) {
				if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) {
					return;
				}
				started = true;
				setDragPayload(payload);
			}

			placeGhost(ghostRef.current);

			const next = resolveTarget(moveEvent.clientX, moveEvent.clientY, payload);
			if (targetKey(next) !== targetKey(dropTargetRef.current)) {
				dropTargetRef.current = next;
				setDropTarget(next);
			}
		};

		const finish = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', finish);
			window.removeEventListener('pointercancel', finish);
			if (started) commitDrop(payload, dropTargetRef.current);
			dropTargetRef.current = null;
			setDropTarget(null);
			setDragPayload(null);
		};

		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', finish);
		window.addEventListener('pointercancel', finish);
	}, [commitDrop, placeGhost]);

	/**
	 * Node cards move by writing to the element's own style during the drag and
	 * committing once on release, so dragging a card never re-renders its blocks.
	 */
	const beginNodeDrag = useCallback((nodeId: string, event: ReactPointerEvent) => {
		if (event.button !== 0) return;
		if ((event.target as HTMLElement).closest('input, select, textarea, button')) return;

		const card = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-node-card]');
		const canvas = card?.parentElement;
		if (!card || !canvas) return;

		const startX = event.clientX;
		const startY = event.clientY;
		const originX = card.offsetLeft;
		const originY = card.offsetTop;
		let x = originX;
		let y = originY;

		const move = (moveEvent: PointerEvent) => {
			x = Math.max(0, originX + moveEvent.clientX - startX);
			y = Math.max(0, originY + moveEvent.clientY - startY);
			card.style.left = `${x}px`;
			card.style.top = `${y}px`;
		};

		const finish = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', finish);
			window.removeEventListener('pointercancel', finish);
			setProgram((current) => ({
				nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
			}));
		};

		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', finish);
		window.addEventListener('pointercancel', finish);
	}, []);

	// ------------------------------------------------------------------ view

	const draggingId =
		dragPayload?.type === 'move-stmt'
			? dragPayload.stmt.id
			: dragPayload?.type === 'move-decl'
				? dragPayload.decl.id
				: null;

	const blockCtx: BlockContext = {
		knownTopics,
		target: dropTarget,
		draggingId,
		onPatch: patchStatement,
		beginDrag,
	};

	const canvasOver = dropTarget?.type === 'canvas';
	const movingExisting = dragPayload?.type === 'move-stmt' || dragPayload?.type === 'move-decl';

	return (
		<div className="ros-app">
			<div className="ros-toolbar">
				<div className="ros-transport">
					<button
						type="button"
						className="ros-btn primary"
						onClick={() => (running ? sim.pause() : sim.start())}
					>
						{running ? '❚❚ Pause' : '▶ Run'}
					</button>
					<button type="button" className="ros-btn" onClick={() => sim.reset()}>
						↺ Reset
					</button>
					<button
						type="button"
						className="ros-btn"
						disabled={program.nodes.length === 0}
						onClick={() => {
							if (window.confirm('Delete every node in the workspace?')) {
								sim.reset();
								setProgram({ nodes: [] });
							}
						}}
					>
						Clear
					</button>
				</div>

				<div className={`ros-status${running ? ' running' : ''}`}>
					<span className="led" aria-hidden="true" />
					<span>{running ? 'running' : 'stopped'}</span>
					<Clock sim={sim} running={running} />
				</div>
			</div>

			<div className="ros-shell">
				<div className="ros-panel">
					<div className="ros-panel-head">
						<span>Blocks</span>
						<span className="hint">drag →</span>
					</div>
					<div className="ros-panel-body">
						<BlockPalette
							unlocked={unlocked}
							armedAsTrash={Boolean(movingExisting)}
							trashHot={dropTarget?.type === 'trash'}
							beginDrag={beginDrag}
						/>
					</div>
				</div>

				<div className="ros-column">
					<div className="ros-panel">
						<div className="ros-panel-head">
							<span>Workspace</span>
							<span className="hint">
								{program.nodes.length} node{program.nodes.length === 1 ? '' : 's'}
							</span>
						</div>
						<div
							className={`ros-panel-body ros-canvas${canvasOver ? ' drop-active' : ''}`}
							data-drop="canvas"
						>
							{program.nodes.length === 0 && (
								<div className="ros-canvas-empty">
									<strong>Empty workspace</strong>
									<span>Drag the node block from the left to start.</span>
								</div>
							)}

							{program.nodes.map((node) => (
								<NodeCard
									key={node.id}
									node={node}
									ctx={blockCtx}
									active={false}
									onRename={(name) =>
										setProgram((current) => ({
											nodes: current.nodes.map((n) => (n.id === node.id ? { ...n, name } : n)),
										}))
									}
									onRate={(rateHz) =>
										setProgram((current) => ({
											nodes: current.nodes.map((n) => (n.id === node.id ? { ...n, rateHz } : n)),
										}))
									}
									onRemove={() =>
										setProgram((current) => ({
											nodes: current.nodes.filter((n) => n.id !== node.id),
										}))
									}
									onDeclTopic={(declId, topic) =>
										setProgram((current) => ({
											nodes: current.nodes.map((n) =>
												n.id === node.id
													? {
															...n,
															declarations: n.declarations.map((d) =>
																d.id === declId ? { ...d, topic } : d,
															),
														}
													: n,
											),
										}))
									}
									onHeaderPointerDown={(event) => beginNodeDrag(node.id, event)}
								/>
							))}
						</div>
					</div>

					<div className="ros-panel ros-console">
						<div className="ros-panel-head">
							<span>Console</span>
							<span className="hint">nodes, topics, errors</span>
						</div>
						<MemoConsole sim={sim} showTraffic />
					</div>
				</div>

				<div className="ros-column side">
					<div className="ros-panel">
						<div className="ros-panel-head">
							<span>Lesson</span>
							<span className="hint">{completed.size}/{LESSONS.length} done</span>
						</div>
						<div className="ros-panel-body">
							<LessonPanel
								lesson={lesson}
								index={lessonIndex}
								completed={completed}
								passed={completed.has(lesson.id)}
								onSelect={setLessonIndex}
							/>
						</div>
					</div>

					<div className="ros-panel">
						<div className="ros-panel-head">
							<span>Robot</span>
							<span className="hint">/cmd_vel · /scan</span>
						</div>
						<MemoRobot sim={sim} arena={lesson.arena} />
					</div>

					<div className="ros-panel">
						<div className="ros-panel-head">
							<span>ROS graph</span>
							<span className="hint">nodes and topics</span>
						</div>
						<div className="ros-panel-body">
							<MemoGraph graph={graph} sim={sim} />
						</div>
					</div>
				</div>
			</div>

			{dragPayload && (
				<div className="ros-ghost" ref={placeGhost} aria-hidden="true">
					<GhostBlock payload={dragPayload} />
				</div>
			)}

			{toast && (
				<output className="ros-toast">
					<span aria-hidden="true">✓</span>
					{toast}
				</output>
			)}
		</div>
	);
}

/** Simulation clock, ticking on its own timer so it never re-renders the editor. */
function Clock({ sim, running }: { sim: Simulation; running: boolean }) {
	const ref = useRef<HTMLSpanElement | null>(null);

	useEffect(() => {
		const write = () => {
			if (ref.current) ref.current.textContent = `${sim.time.toFixed(1)}s`;
		};
		write();
		if (!running) return;
		const timer = window.setInterval(write, 100);
		return () => window.clearInterval(timer);
	}, [sim, running]);

	return <span className="ros-clock" ref={ref} />;
}

function GhostBlock({ payload }: { payload: DragPayload }) {
	const label =
		payload.type === 'new-node'
			? 'node'
			: payload.type === 'new-decl'
				? payload.kind
				: payload.type === 'new-stmt'
					? payload.kind
					: payload.type === 'move-stmt'
						? payload.stmt.kind
						: payload.decl.kind;

	const accent = payload.type === 'new-node' ? 'node' : (ACCENT[label] ?? 'pub');

	return (
		<div className="ros-block" data-accent={accent}>
			<div className="ros-block-row">
				<span className="ros-block-kw">{label}</span>
			</div>
		</div>
	);
}

/** Stable identity for a drop target, used to skip redundant renders mid-drag. */
function targetKey(target: DropTarget | null): string {
	if (!target) return '';
	switch (target.type) {
		case 'trash':
			return 'trash';
		case 'canvas':
			return 'canvas';
		case 'decls':
			return `decls:${target.nodeId}`;
		case 'stack':
			return `stack:${target.nodeId}:${target.parentId ?? ''}:${target.index}`;
	}
}
