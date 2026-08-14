/**
 * The student's program.
 *
 * This is the "tiny internal representation" the visual blocks compile to. It is
 * intentionally not a general-purpose language: a program is a list of nodes,
 * each node declares publishers and subscribers and holds a flat-ish stack of
 * statements that run on a timer. `if` is the only block that nests, because
 * obstacle avoidance is impossible to express without it.
 */

import { CMD_VEL, SCAN, type MessageType, typeOfTopic } from './types';

export type BlockKind = 'publisher' | 'subscriber' | 'publish' | 'log' | 'if';

/** A value slot in a block: either a typed-in number or a field off a subscription. */
export type Expr =
	| { kind: 'number'; value: number }
	| { kind: 'field'; source: SensorField };

/**
 * Readable sensor fields. Kept as a closed list so the UI can offer a dropdown
 * and the interpreter never has to parse anything.
 */
export type SensorField = 'scan.front' | 'scan.left' | 'scan.right' | 'scan.min';

export const SENSOR_FIELDS: SensorField[] = ['scan.front', 'scan.left', 'scan.right', 'scan.min'];

export type Comparison = '<' | '>';

export interface PublishBlock {
	id: string;
	kind: 'publish';
	topic: string;
	/** Field values by name; which names matter depends on the topic's type. */
	values: Record<string, Expr>;
}

export interface LogBlock {
	id: string;
	kind: 'log';
	text: string;
	/** Optional value appended to the text, so students can watch a number change. */
	value?: Expr;
}

export interface IfBlock {
	id: string;
	kind: 'if';
	left: Expr;
	op: Comparison;
	right: Expr;
	body: Statement[];
}

export type Statement = PublishBlock | LogBlock | IfBlock;

/** Declarations live above the statement stack, mirroring how a real node reads. */
export interface PublisherDecl {
	id: string;
	kind: 'publisher';
	topic: string;
}

export interface SubscriberDecl {
	id: string;
	kind: 'subscriber';
	topic: string;
}

export type Declaration = PublisherDecl | SubscriberDecl;

export interface ProgramNode {
	id: string;
	name: string;
	/** How often the statement stack runs, in Hz. This is the node's timer. */
	rateHz: number;
	declarations: Declaration[];
	body: Statement[];
	/** Workspace position, so the layout survives a reload. */
	x: number;
	y: number;
}

export interface Program {
	nodes: ProgramNode[];
}

let counter = 0;

/** Ids only need to be unique within a session; they are never persisted across users. */
export function uid(prefix: string): string {
	counter += 1;
	return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const num = (value: number): Expr => ({ kind: 'number', value });
export const field = (source: SensorField): Expr => ({ kind: 'field', source });

/** Field names a publish block should show for a given topic. */
export function publishFields(topic: string): string[] {
	const type: MessageType = typeOfTopic(topic);
	if (type === 'geometry_msgs/Twist') return ['linear', 'angular'];
	return ['data'];
}

export function newPublishBlock(topic = CMD_VEL): PublishBlock {
	const values: Record<string, Expr> = {};
	for (const name of publishFields(topic)) values[name] = num(0);
	return { id: uid('pub'), kind: 'publish', topic, values };
}

export function newLogBlock(): LogBlock {
	return { id: uid('log'), kind: 'log', text: 'hello' };
}

export function newIfBlock(): IfBlock {
	return { id: uid('if'), kind: 'if', left: field('scan.front'), op: '<', right: num(1), body: [] };
}

export function newPublisherDecl(topic = CMD_VEL): PublisherDecl {
	return { id: uid('pubd'), kind: 'publisher', topic };
}

export function newSubscriberDecl(topic = SCAN): SubscriberDecl {
	return { id: uid('subd'), kind: 'subscriber', topic };
}

export function newNode(name: string, x: number, y: number): ProgramNode {
	return { id: uid('node'), name, rateHz: 10, declarations: [], body: [], x, y };
}

/** Topics a node publishes to, taken from its declarations. */
export function publishedTopics(node: ProgramNode): string[] {
	return node.declarations.filter((d) => d.kind === 'publisher').map((d) => d.topic);
}

export function subscribedTopics(node: ProgramNode): string[] {
	return node.declarations.filter((d) => d.kind === 'subscriber').map((d) => d.topic);
}

/** Depth-first walk of a statement tree, parents before children. */
export function walk(body: Statement[], visit: (stmt: Statement) => void): void {
	for (const stmt of body) {
		visit(stmt);
		if (stmt.kind === 'if') walk(stmt.body, visit);
	}
}

/** Every topic mentioned anywhere, including by publish blocks with no declaration. */
export function allTopics(program: Program): string[] {
	const topics = new Set<string>();
	for (const node of program.nodes) {
		for (const decl of node.declarations) topics.add(decl.topic);
		walk(node.body, (stmt) => {
			if (stmt.kind === 'publish') topics.add(stmt.topic);
		});
	}
	return [...topics].sort();
}

/**
 * Returns a copy of `body` with `stmt` inserted at `index` inside the container
 * identified by `parentId` (null meaning the node's top level). Removal is a
 * separate pass so a drag can move a block between containers safely.
 */
export function insertStatement(
	body: Statement[],
	parentId: string | null,
	index: number,
	stmt: Statement,
): Statement[] {
	if (parentId === null) {
		const next = [...body];
		next.splice(clampIndex(index, next.length), 0, stmt);
		return next;
	}
	return body.map((child) => {
		if (child.kind !== 'if') return child;
		if (child.id === parentId) {
			const inner = [...child.body];
			inner.splice(clampIndex(index, inner.length), 0, stmt);
			return { ...child, body: inner };
		}
		return { ...child, body: insertStatement(child.body, parentId, index, stmt) };
	});
}

export function removeStatement(body: Statement[], id: string): Statement[] {
	return body
		.filter((stmt) => stmt.id !== id)
		.map((stmt) => (stmt.kind === 'if' ? { ...stmt, body: removeStatement(stmt.body, id) } : stmt));
}

export function findStatement(body: Statement[], id: string): Statement | null {
	for (const stmt of body) {
		if (stmt.id === id) return stmt;
		if (stmt.kind === 'if') {
			const found = findStatement(stmt.body, id);
			if (found) return found;
		}
	}
	return null;
}

/** Where a statement currently sits, so a move can adjust its target index. */
export function locateStatement(
	body: Statement[],
	id: string,
	parentId: string | null = null,
): { parentId: string | null; index: number } | null {
	for (let index = 0; index < body.length; index += 1) {
		const stmt = body[index];
		if (stmt.id === id) return { parentId, index };
		if (stmt.kind === 'if') {
			const found = locateStatement(stmt.body, id, stmt.id);
			if (found) return found;
		}
	}
	return null;
}

/** True if `id` is `stmt` or lives anywhere inside it — guards self-nesting drops. */
export function containsStatement(stmt: Statement, id: string): boolean {
	if (stmt.id === id) return true;
	if (stmt.kind !== 'if') return false;
	return stmt.body.some((child) => containsStatement(child, id));
}

export function updateStatement(
	body: Statement[],
	id: string,
	patch: (stmt: Statement) => Statement,
): Statement[] {
	return body.map((stmt) => {
		if (stmt.id === id) return patch(stmt);
		if (stmt.kind === 'if') return { ...stmt, body: updateStatement(stmt.body, id, patch) };
		return stmt;
	});
}

function clampIndex(index: number, length: number): number {
	if (index < 0) return 0;
	if (index > length) return length;
	return index;
}

export const emptyProgram = (): Program => ({ nodes: [] });
