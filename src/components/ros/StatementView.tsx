import { Fragment, type PointerEvent as ReactPointerEvent } from 'react';

import {
	type Comparison,
	type SensorField,
	type Statement,
	SENSOR_FIELDS,
	field,
	newPublishBlock,
	publishFields,
} from '../../lib/ros-sim/program';
import type { DragPayload, DropTarget } from './dnd';
import ExprInput from './ExprInput';
import TopicInput from './TopicInput';

/** Shared plumbing every block in a stack needs, bundled to keep props shallow. */
export interface BlockContext {
	knownTopics: string[];
	target: DropTarget | null;
	/** Id of the statement currently being dragged out, so it can be dimmed. */
	draggingId: string | null;
	onPatch: (id: string, patch: (stmt: Statement) => Statement) => void;
	beginDrag: (payload: DragPayload, event: ReactPointerEvent) => void;
}

export const ACCENT: Record<string, string> = {
	publish: 'pub',
	publisher: 'pub',
	subscriber: 'sub',
	log: 'sub',
	if: 'ctl',
};

interface StackProps {
	nodeId: string;
	parentId: string | null;
	body: Statement[];
	ctx: BlockContext;
	emptyLabel: string;
}

/**
 * A droppable column of blocks.
 *
 * The insertion rule lives in dnd.ts; this only draws the result. The lime rule
 * appears at exactly the index a drop would use, which is what makes the snap
 * legible before the student commits.
 */
export function StatementStack({ nodeId, parentId, body, ctx, emptyLabel }: StackProps) {
	const { target } = ctx;
	const isOver =
		target?.type === 'stack' && target.nodeId === nodeId && target.parentId === parentId;
	const insertionAt = isOver ? target.index : -1;

	return (
		<div
			className={`ros-dropzone${body.length === 0 ? ' empty' : ''}${isOver ? ' over' : ''}`}
			data-drop="stack"
			data-node={nodeId}
			data-parent={parentId ?? ''}
		>
			{body.length === 0 && insertionAt === -1 && <span>{emptyLabel}</span>}

			{body.map((stmt, index) => (
				<Fragment key={stmt.id}>
					{insertionAt === index && <div className="ros-insertion" />}
					<div className="ros-slot" data-slot={index}>
						<StatementView stmt={stmt} nodeId={nodeId} ctx={ctx} />
					</div>
				</Fragment>
			))}

			{insertionAt >= body.length && <div className="ros-insertion" />}
		</div>
	);
}

interface ViewProps {
	stmt: Statement;
	nodeId: string;
	ctx: BlockContext;
}

export default function StatementView({ stmt, nodeId, ctx }: ViewProps) {
	const dragging = ctx.draggingId === stmt.id;

	const grip = {
		className: 'ros-block-grip ros-block-row',
		onPointerDown: (event: ReactPointerEvent) =>
			ctx.beginDrag({ type: 'move-stmt', nodeId, stmt }, event),
	};

	if (stmt.kind === 'publish') {
		const fields = publishFields(stmt.topic);
		return (
			<div className={`ros-block${dragging ? ' dragging' : ''}`} data-accent={ACCENT.publish}>
				<div {...grip}>
					<span className="ros-block-kw">publish</span>
					<span className="ros-block-word">to</span>
					<TopicInput
						value={stmt.topic}
						known={ctx.knownTopics}
						label="publish topic"
						onChange={(topic) =>
							ctx.onPatch(stmt.id, (current) => {
								if (current.kind !== 'publish') return current;
								// Message shape follows the topic, so switching topics rebuilds
								// the value slots instead of leaving stale ones behind.
								const blank = newPublishBlock(topic);
								const values = { ...blank.values };
								for (const name of Object.keys(values)) {
									if (current.values[name]) values[name] = current.values[name];
								}
								return { ...current, topic, values };
							})
						}
					/>
				</div>

				{fields.map((name) => (
					<div className="ros-block-row" key={name}>
						<span className="ros-block-word">{name}</span>
						<ExprInput
							label={`${name} on ${stmt.topic}`}
							value={stmt.values[name] ?? { kind: 'number', value: 0 }}
							onChange={(expr) =>
								ctx.onPatch(stmt.id, (current) =>
									current.kind === 'publish'
										? { ...current, values: { ...current.values, [name]: expr } }
										: current,
								)
							}
						/>
					</div>
				))}
			</div>
		);
	}

	if (stmt.kind === 'log') {
		const source = stmt.value?.kind === 'field' ? stmt.value.source : 'none';
		return (
			<div className={`ros-block${dragging ? ' dragging' : ''}`} data-accent={ACCENT.log}>
				<div {...grip}>
					<span className="ros-block-kw">log</span>
					<input
						className="ros-input text"
						value={stmt.text}
						aria-label="log text"
						onChange={(event) =>
							ctx.onPatch(stmt.id, (current) =>
								current.kind === 'log' ? { ...current, text: event.target.value } : current,
							)
						}
					/>
					<select
						className="ros-select"
						value={source}
						aria-label="log value"
						onChange={(event) =>
							ctx.onPatch(stmt.id, (current) => {
								if (current.kind !== 'log') return current;
								const next = event.target.value;
								return next === 'none'
									? { ...current, value: undefined }
									: { ...current, value: field(next as SensorField) };
							})
						}
					>
						<option value="none">no value</option>
						{SENSOR_FIELDS.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
				</div>
			</div>
		);
	}

	return (
		<div className={`ros-block${dragging ? ' dragging' : ''}`} data-accent={ACCENT.if}>
			<div {...grip}>
				<span className="ros-block-kw">if</span>
				<ExprInput
					label="left side"
					value={stmt.left}
					onChange={(expr) =>
						ctx.onPatch(stmt.id, (current) =>
							current.kind === 'if' ? { ...current, left: expr } : current,
						)
					}
				/>
				<select
					className="ros-select"
					value={stmt.op}
					aria-label="comparison"
					onChange={(event) =>
						ctx.onPatch(stmt.id, (current) =>
							current.kind === 'if'
								? { ...current, op: event.target.value as Comparison }
								: current,
						)
					}
				>
					<option value="<">&lt;</option>
					<option value=">">&gt;</option>
				</select>
				<ExprInput
					label="right side"
					value={stmt.right}
					onChange={(expr) =>
						ctx.onPatch(stmt.id, (current) =>
							current.kind === 'if' ? { ...current, right: expr } : current,
						)
					}
				/>
				<span className="ros-block-word">then</span>
			</div>

			<div className="ros-nest">
				<StatementStack
					nodeId={nodeId}
					parentId={stmt.id}
					body={stmt.body}
					ctx={ctx}
					emptyLabel="drop blocks here"
				/>
			</div>
		</div>
	);
}
