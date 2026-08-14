/**
 * Executes a node's statement stack.
 *
 * Deliberately not a language: no variables, no loops, no user functions. The
 * only control flow is `if`, and the only readable state is the last message
 * that arrived on a subscription. That keeps the interesting part of the
 * workshop — wiring publishers to subscribers — the part students actually
 * spend their attention on.
 */

import type { Expr, SensorField, Statement } from './program';
import { SCAN_RANGE } from './Robot';
import type { LaserScan, MessagePayload, ROSMessage } from './types';
import { SCAN, typeOfTopic } from './types';

export interface ExecContext {
	nodeId: string;
	nodeName: string;
	/** Latest message per topic this node subscribes to. */
	inbox: Map<string, ROSMessage>;
	publish: (topic: string, payload: MessagePayload) => void;
	log: (text: string) => void;
	/** Reported once per run when a node reads a sensor it never subscribed to. */
	warn: (text: string) => void;
}

/**
 * Which rays each field reads; see SCAN_ANGLES for the bearings.
 *
 * `scan.front` deliberately spans the three forward rays rather than the single
 * centre one. The body is wider than a ray, so a centre-only reading lets a
 * student drive confidently into a corner the beam sailed past — "how far ahead
 * is clear" is both what they mean and what keeps the robot out of trouble.
 */
const FIELD_RAYS: Record<Exclude<SensorField, 'scan.min'>, number[]> = {
	'scan.front': [0, 1, 2],
	'scan.left': [3],
	'scan.right': [4],
};

export function evaluate(expr: Expr, ctx: ExecContext): number {
	if (expr.kind === 'number') return expr.value;

	const message = ctx.inbox.get(SCAN);
	if (!message) {
		ctx.warn(`${ctx.nodeName} reads ${expr.source} but has no subscriber on ${SCAN}`);
		return SCAN_RANGE;
	}

	const scan = message.payload as LaserScan;
	if (expr.source === 'scan.min') {
		return scan.ranges.length ? Math.min(...scan.ranges) : SCAN_RANGE;
	}

	const readings = FIELD_RAYS[expr.source]
		.map((index) => scan.ranges[index])
		.filter((value): value is number => value !== undefined);

	return readings.length ? Math.min(...readings) : SCAN_RANGE;
}

export function runBody(body: Statement[], ctx: ExecContext): void {
	for (const stmt of body) runStatement(stmt, ctx);
}

function runStatement(stmt: Statement, ctx: ExecContext): void {
	switch (stmt.kind) {
		case 'publish': {
			ctx.publish(stmt.topic, buildPayload(stmt.topic, stmt.values, ctx));
			return;
		}
		case 'log': {
			const value = stmt.value ? ` ${evaluate(stmt.value, ctx).toFixed(2)}` : '';
			ctx.log(`${stmt.text}${value}`);
			return;
		}
		case 'if': {
			const left = evaluate(stmt.left, ctx);
			const right = evaluate(stmt.right, ctx);
			if (stmt.op === '<' ? left < right : left > right) runBody(stmt.body, ctx);
			return;
		}
	}
}

function buildPayload(
	topic: string,
	values: Record<string, Expr>,
	ctx: ExecContext,
): MessagePayload {
	const read = (name: string) => (values[name] ? evaluate(values[name], ctx) : 0);

	if (typeOfTopic(topic) === 'geometry_msgs/Twist') {
		return { linear: read('linear'), angular: read('angular') };
	}
	return { data: read('data') };
}
