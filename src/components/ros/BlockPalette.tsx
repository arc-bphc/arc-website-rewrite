import type { PointerEvent as ReactPointerEvent } from 'react';

import type { BlockKind } from '../../lib/ros-sim/program';
import { CMD_VEL, SCAN } from '../../lib/ros-sim/types';
import type { DragPayload } from './dnd';
import { ACCENT } from './StatementView';

interface Props {
	unlocked: Set<BlockKind>;
	/** While an existing block is being dragged, the palette becomes a bin. */
	armedAsTrash: boolean;
	trashHot: boolean;
	beginDrag: (payload: DragPayload, event: ReactPointerEvent) => void;
}

interface Item {
	kind: BlockKind | 'node';
	label: string;
	detail: string;
	payload: DragPayload;
	accent: string;
}

const GROUPS: { label: string; items: Item[] }[] = [
	{
		label: 'Node',
		items: [
			{
				kind: 'node',
				label: 'node',
				detail: 'a running program',
				payload: { type: 'new-node' },
				accent: 'node',
			},
		],
	},
	{
		label: 'Connections',
		items: [
			{
				kind: 'publisher',
				label: 'publisher',
				detail: `on ${CMD_VEL}`,
				payload: { type: 'new-decl', kind: 'publisher' },
				accent: ACCENT.publisher,
			},
			{
				kind: 'subscriber',
				label: 'subscriber',
				detail: `to ${SCAN}`,
				payload: { type: 'new-decl', kind: 'subscriber' },
				accent: ACCENT.subscriber,
			},
		],
	},
	{
		label: 'Actions',
		items: [
			{
				kind: 'publish',
				label: 'publish',
				detail: 'send a message',
				payload: { type: 'new-stmt', kind: 'publish' },
				accent: ACCENT.publish,
			},
			{
				kind: 'log',
				label: 'log',
				detail: 'print to console',
				payload: { type: 'new-stmt', kind: 'log' },
				accent: ACCENT.log,
			},
		],
	},
	{
		label: 'Control',
		items: [
			{
				kind: 'if',
				label: 'if',
				detail: 'do this only when…',
				payload: { type: 'new-stmt', kind: 'if' },
				accent: ACCENT.if,
			},
		],
	},
];

export default function BlockPalette({ unlocked, armedAsTrash, trashHot, beginDrag }: Props) {
	return (
		<div
			className={`ros-palette${trashHot ? ' trash-armed' : ''}`}
			data-drop={armedAsTrash ? 'trash' : undefined}
		>
			{armedAsTrash && <span className="ros-trash-hint">drop here to delete</span>}

			{GROUPS.map((group) => (
				<div className="ros-palette-group" key={group.label}>
					<span className="ros-palette-label">{group.label}</span>

					{group.items.map((item) => {
						// The node block is always available; every other block is earned.
						const locked = item.kind !== 'node' && !unlocked.has(item.kind as BlockKind);

						return (
							<div
								key={item.label}
								className={`ros-palette-item${locked ? ' locked' : ''}`}
								onPointerDown={locked ? undefined : (event) => beginDrag(item.payload, event)}
								aria-disabled={locked}
								title={locked ? 'Unlocks in a later lesson' : `Drag to add a ${item.label} block`}
							>
								<div className="ros-block" data-accent={item.accent}>
									<div className="ros-block-row">
										<span className="ros-block-kw">{item.label}</span>
									</div>
									<div className="ros-block-row">
										<span className="ros-block-word">{item.detail}</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			))}

			<p className="ros-locked-note">
				Greyed blocks unlock as you work through the lessons. Drag a block back here to delete it.
			</p>
		</div>
	);
}
