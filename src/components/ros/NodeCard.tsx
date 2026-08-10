import type { PointerEvent as ReactPointerEvent } from 'react';

import type { Declaration, ProgramNode } from '../../lib/ros-sim/program';
import type { DragPayload } from './dnd';
import { ACCENT, type BlockContext, StatementStack } from './StatementView';
import TopicInput from './TopicInput';

interface Props {
	node: ProgramNode;
	ctx: BlockContext;
	/** True while a message from this node is in flight, for a subtle live outline. */
	active: boolean;
	onRename: (name: string) => void;
	onRate: (rateHz: number) => void;
	onRemove: () => void;
	onDeclTopic: (declId: string, topic: string) => void;
	onHeaderPointerDown: (event: ReactPointerEvent) => void;
}

/**
 * One node in the workspace.
 *
 * Reads top to bottom the way a ROS node's source does: what it is called, how
 * often it runs, what it connects to, then what it does.
 */
export default function NodeCard({
	node,
	ctx,
	active,
	onRename,
	onRate,
	onRemove,
	onDeclTopic,
	onHeaderPointerDown,
}: Props) {
	const declTarget = ctx.target;
	const declsOver = declTarget?.type === 'decls' && declTarget.nodeId === node.id;

	return (
		<div
			className={`ros-node${active ? ' active' : ''}`}
			style={{ left: node.x, top: node.y }}
			data-node-card={node.id}
		>
			<div className="ros-node-head" onPointerDown={onHeaderPointerDown}>
				<input
					className="ros-node-name"
					value={node.name}
					aria-label="node name"
					spellCheck={false}
					onChange={(event) => onRename(event.target.value)}
				/>

				<label className="ros-node-rate">
					<input
						className="ros-input num"
						type="number"
						min={0.5}
						max={50}
						step={1}
						value={node.rateHz}
						aria-label={`${node.name} timer rate in hertz`}
						onChange={(event) => onRate(Number.parseFloat(event.target.value) || 1)}
					/>
					Hz
				</label>

				<button
					type="button"
					className="ros-node-remove"
					aria-label={`delete node ${node.name}`}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={onRemove}
				>
					&times;
				</button>
			</div>

			<div className="ros-node-section">
				<span className="ros-section-label">Connections</span>
				<div
					className={`ros-dropzone${node.declarations.length === 0 ? ' empty' : ''}${
						declsOver ? ' over' : ''
					}`}
					data-drop="decls"
					data-node={node.id}
				>
					{node.declarations.length === 0 && <span>drop a publisher or subscriber</span>}
					{node.declarations.map((decl) => (
						<div className="ros-slot" key={decl.id}>
							<DeclarationBlock
								decl={decl}
								nodeId={node.id}
								ctx={ctx}
								onTopic={(topic) => onDeclTopic(decl.id, topic)}
							/>
						</div>
					))}
				</div>
			</div>

			<div className="ros-node-section">
				<span className="ros-section-label">Every tick</span>
				<StatementStack
					nodeId={node.id}
					parentId={null}
					body={node.body}
					ctx={ctx}
					emptyLabel="drop blocks here"
				/>
			</div>
		</div>
	);
}

interface DeclProps {
	decl: Declaration;
	nodeId: string;
	ctx: BlockContext;
	onTopic: (topic: string) => void;
}

function DeclarationBlock({ decl, nodeId, ctx, onTopic }: DeclProps) {
	const payload: DragPayload = { type: 'move-decl', nodeId, decl };

	return (
		<div
			className={`ros-block${ctx.draggingId === decl.id ? ' dragging' : ''}`}
			data-accent={ACCENT[decl.kind]}
		>
			<div
				className="ros-block-grip ros-block-row"
				onPointerDown={(event) => ctx.beginDrag(payload, event)}
			>
				<span className="ros-block-kw">{decl.kind}</span>
				<span className="ros-block-word">{decl.kind === 'publisher' ? 'on' : 'to'}</span>
				<TopicInput
					value={decl.topic}
					known={ctx.knownTopics}
					label={`${decl.kind} topic`}
					onChange={onTopic}
				/>
			</div>
		</div>
	);
}
