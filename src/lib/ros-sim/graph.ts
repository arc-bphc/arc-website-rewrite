/**
 * Derives the drawable ROS graph from a program.
 *
 * Layout is deterministic (a BFS layering, then even stacking within a column)
 * rather than force-directed. A student who adds a node wants the diagram to
 * stay recognisable, not to reshuffle itself; and a graph this small has no
 * crossings worth optimising away.
 */

import type { Program } from './program';
import { publishedTopics, subscribedTopics, walk } from './program';
import { CMD_VEL, ROBOT_NODE, SCAN } from './types';

export interface GraphVertex {
	id: string;
	label: string;
	kind: 'node' | 'topic';
	/** The built-in robot is drawn differently from student nodes. */
	builtin: boolean;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface GraphEdge {
	id: string;
	from: string;
	to: string;
	/** SVG path data, already routed around the column gap. */
	d: string;
	/** Topic the packet on this edge belongs to. */
	topic: string;
	/** True for topic -> node, which is the half a packet travels second. */
	inbound: boolean;
}

export interface Graph {
	vertices: GraphVertex[];
	edges: GraphEdge[];
	width: number;
	height: number;
}

const NODE_W = 152;
const NODE_H = 46;
const TOPIC_W = 148;
const TOPIC_H = 32;
const COL_GAP = 76;
const ROW_GAP = 26;
const PADDING = 24;

interface RawVertex {
	id: string;
	label: string;
	kind: 'node' | 'topic';
	builtin: boolean;
}

export function buildGraph(program: Program): Graph {
	const vertices: RawVertex[] = [];
	const seen = new Set<string>();
	const edges: { from: string; to: string; topic: string; inbound: boolean }[] = [];

	const addVertex = (v: RawVertex) => {
		if (seen.has(v.id)) return;
		seen.add(v.id);
		vertices.push(v);
	};

	const topicId = (topic: string) => `topic:${topic}`;

	for (const node of program.nodes) {
		addVertex({ id: node.id, label: node.name, kind: 'node', builtin: false });

		for (const topic of publishedTopics(node)) {
			addVertex({ id: topicId(topic), label: topic, kind: 'topic', builtin: false });
			edges.push({ from: node.id, to: topicId(topic), topic, inbound: false });
		}

		for (const topic of subscribedTopics(node)) {
			addVertex({ id: topicId(topic), label: topic, kind: 'topic', builtin: false });
			edges.push({ from: topicId(topic), to: node.id, topic, inbound: true });
		}

		// A publish block on an undeclared topic still shows the topic, greyed by
		// the view, so the student can see what their block is aiming at.
		walk(node.body, (stmt) => {
			if (stmt.kind === 'publish') {
				addVertex({ id: topicId(stmt.topic), label: stmt.topic, kind: 'topic', builtin: false });
			}
		});
	}

	// The robot only joins the diagram once a student's graph touches it.
	const touchesRobot = seen.has(topicId(CMD_VEL)) || seen.has(topicId(SCAN));
	if (touchesRobot) {
		addVertex({ id: ROBOT_NODE, label: 'robot', kind: 'node', builtin: true });
		if (seen.has(topicId(CMD_VEL))) {
			edges.push({ from: topicId(CMD_VEL), to: ROBOT_NODE, topic: CMD_VEL, inbound: true });
		}
		addVertex({ id: topicId(SCAN), label: SCAN, kind: 'topic', builtin: true });
		edges.push({ from: ROBOT_NODE, to: topicId(SCAN), topic: SCAN, inbound: false });
	}

	return layout(vertices, edges);
}

function layout(
	vertices: RawVertex[],
	rawEdges: { from: string; to: string; topic: string; inbound: boolean }[],
): Graph {
	const layers = assignLayers(vertices, rawEdges);

	const byLayer = new Map<number, RawVertex[]>();
	for (const vertex of vertices) {
		const layer = layers.get(vertex.id) ?? 0;
		const list = byLayer.get(layer) ?? [];
		list.push(vertex);
		byLayer.set(layer, list);
	}

	const columns = [...byLayer.keys()].sort((a, b) => a - b);
	const columnHeights = columns.map((layer) => {
		const list = byLayer.get(layer) ?? [];
		return list.reduce((sum, v) => sum + heightOf(v) + ROW_GAP, -ROW_GAP);
	});
	const contentHeight = Math.max(0, ...columnHeights);

	const placed = new Map<string, GraphVertex>();
	let cursorX = PADDING;

	columns.forEach((layer, columnIndex) => {
		const list = byLayer.get(layer) ?? [];
		const columnWidth = Math.max(...list.map(widthOf));
		let cursorY = PADDING + (contentHeight - columnHeights[columnIndex]) / 2;

		for (const vertex of list) {
			const w = widthOf(vertex);
			const h = heightOf(vertex);
			placed.set(vertex.id, {
				...vertex,
				// Centred in its column so mixed node/topic columns stay tidy.
				x: cursorX + (columnWidth - w) / 2,
				y: cursorY,
				w,
				h,
			});
			cursorY += h + ROW_GAP;
		}

		cursorX += columnWidth + COL_GAP;
	});

	const edges: GraphEdge[] = rawEdges.map((edge, index) => {
		const from = placed.get(edge.from);
		const to = placed.get(edge.to);
		return {
			id: `e${index}:${edge.from}->${edge.to}`,
			from: edge.from,
			to: edge.to,
			topic: edge.topic,
			inbound: edge.inbound,
			d: from && to ? route(from, to) : '',
		};
	});

	return {
		vertices: [...placed.values()],
		edges,
		width: Math.max(cursorX - COL_GAP + PADDING, 320),
		height: contentHeight + PADDING * 2,
	};
}

/**
 * BFS layering. Cycles are expected — the canonical
 * controller -> /cmd_vel -> robot -> /scan -> controller loop is one — so the
 * first visit wins and the back edge simply routes backwards.
 */
function assignLayers(
	vertices: RawVertex[],
	edges: { from: string; to: string }[],
): Map<string, number> {
	const outgoing = new Map<string, string[]>();
	const indegree = new Map<string, number>();
	for (const vertex of vertices) {
		outgoing.set(vertex.id, []);
		indegree.set(vertex.id, 0);
	}
	for (const edge of edges) {
		outgoing.get(edge.from)?.push(edge.to);
		indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
	}

	const layers = new Map<string, number>();
	const roots = vertices.filter((v) => (indegree.get(v.id) ?? 0) === 0).map((v) => v.id);
	// A graph that is nothing but a cycle has no root; seed it with the first
	// vertex so the loop unrolls left-to-right from the student's own node.
	const queue = roots.length ? [...roots] : vertices.length ? [vertices[0].id] : [];
	for (const id of queue) layers.set(id, 0);

	while (queue.length) {
		const id = queue.shift() as string;
		const layer = layers.get(id) ?? 0;
		for (const next of outgoing.get(id) ?? []) {
			if (layers.has(next)) continue;
			layers.set(next, layer + 1);
			queue.push(next);
		}
	}

	// Anything disconnected from the seed starts its own column zero.
	for (const vertex of vertices) {
		if (!layers.has(vertex.id)) layers.set(vertex.id, 0);
	}

	return layers;
}

const widthOf = (v: RawVertex) => (v.kind === 'node' ? NODE_W : TOPIC_W);
const heightOf = (v: RawVertex) => (v.kind === 'node' ? NODE_H : TOPIC_H);

/** Horizontal cubic bezier; a backward edge bows below so it stays readable. */
function route(from: GraphVertex, to: GraphVertex): string {
	const forward = to.x >= from.x;
	const x1 = forward ? from.x + from.w : from.x;
	const y1 = from.y + from.h / 2;
	const x2 = forward ? to.x : to.x + to.w;
	const y2 = to.y + to.h / 2;

	if (forward) {
		const control = Math.max(28, (x2 - x1) / 2);
		return `M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`;
	}

	const drop = Math.max(from.y + from.h, to.y + to.h) + 46;
	return `M ${x1} ${y1} C ${x1 - 60} ${drop}, ${x2 + 60} ${drop}, ${x2} ${y2}`;
}
