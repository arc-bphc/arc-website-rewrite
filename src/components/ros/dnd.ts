/**
 * Pointer-based drag and drop for the block editor.
 *
 * Hand-rolled rather than pulled from a library: the whole requirement is
 * "follow the finger, tell me where it would land", and HTML5 drag-and-drop
 * cannot do the snap preview this needs. Drop targets advertise themselves with
 * data attributes and are resolved by hit-testing, which keeps nested stacks
 * (an if-body inside a node body) working with no extra bookkeeping.
 */

import type { Declaration, Statement } from '../../lib/ros-sim/program';

export type DragPayload =
	| { type: 'new-node' }
	| { type: 'new-decl'; kind: 'publisher' | 'subscriber' }
	| { type: 'new-stmt'; kind: 'publish' | 'log' | 'if' }
	| { type: 'move-stmt'; nodeId: string; stmt: Statement }
	| { type: 'move-decl'; nodeId: string; decl: Declaration };

export type DropTarget =
	| { type: 'canvas'; x: number; y: number }
	| { type: 'decls'; nodeId: string }
	| { type: 'stack'; nodeId: string; parentId: string | null; index: number }
	| { type: 'trash' };

export interface DragState {
	payload: DragPayload;
	/** Current pointer position in client coordinates. */
	x: number;
	y: number;
	/** Pointer offset inside the dragged element, so the ghost sits under the grab point. */
	dx: number;
	dy: number;
	/** Ghost width, copied from the source element so it does not resize mid-drag. */
	width: number;
	target: DropTarget | null;
}

/** Movement in px before a press becomes a drag; below this, it stays a click. */
export const DRAG_THRESHOLD = 4;

/**
 * Resolves what is under the pointer.
 *
 * `elementsFromPoint` returns innermost-first, so the first element carrying a
 * `data-drop` attribute is the most specific target. The drag ghost sets
 * `pointer-events: none` and never appears in this list.
 */
export function resolveTarget(x: number, y: number, payload: DragPayload): DropTarget | null {
	const stack = typeof document === 'undefined' ? [] : document.elementsFromPoint(x, y);

	for (const element of stack) {
		const host = element.closest<HTMLElement>('[data-drop]');
		if (!host) continue;

		const kind = host.dataset.drop;

		if (kind === 'trash') return { type: 'trash' };

		if (kind === 'stack' && acceptsStatement(payload)) {
			const nodeId = host.dataset.node;
			if (!nodeId) continue;
			return {
				type: 'stack',
				nodeId,
				parentId: host.dataset.parent || null,
				index: slotIndexAt(host, y),
			};
		}

		if (kind === 'decls' && acceptsDeclaration(payload)) {
			const nodeId = host.dataset.node;
			if (!nodeId) continue;
			return { type: 'decls', nodeId };
		}

		if (kind === 'canvas' && payload.type === 'new-node') {
			const rect = host.getBoundingClientRect();
			return {
				type: 'canvas',
				x: x - rect.left + host.scrollLeft,
				y: y - rect.top + host.scrollTop,
			};
		}
	}

	return null;
}

const acceptsStatement = (payload: DragPayload) =>
	payload.type === 'new-stmt' || payload.type === 'move-stmt';

const acceptsDeclaration = (payload: DragPayload) =>
	payload.type === 'new-decl' || payload.type === 'move-decl';

/**
 * Which gap in a stack the pointer is closest to. Compares against each slot's
 * vertical midpoint so the insertion line flips as soon as the pointer crosses
 * the halfway mark of a block, which is what makes the snap feel responsive.
 */
function slotIndexAt(stackEl: HTMLElement, y: number): number {
	const slots = [...stackEl.children].filter(
		(child): child is HTMLElement => child instanceof HTMLElement && child.dataset.slot !== undefined,
	);

	for (let i = 0; i < slots.length; i += 1) {
		const rect = slots[i].getBoundingClientRect();
		if (y < rect.top + rect.height / 2) return i;
	}
	return slots.length;
}

/** Human-readable label for the ghost while dragging a fresh block. */
export function payloadLabel(payload: DragPayload): string {
	switch (payload.type) {
		case 'new-node':
			return 'node';
		case 'new-decl':
			return payload.kind;
		case 'new-stmt':
			return payload.kind;
		case 'move-stmt':
			return payload.stmt.kind;
		case 'move-decl':
			return payload.decl.kind;
	}
}
