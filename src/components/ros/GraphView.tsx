import { useEffect, useMemo, useRef } from 'react';

import type { Graph } from '../../lib/ros-sim/graph';
import type { Simulation } from '../../lib/ros-sim/Simulation';

interface Props {
	graph: Graph;
	sim: Simulation;
}

/** Milliseconds a packet takes to cross one edge. */
const HOP_MS = 340;
/**
 * Fixed pool of packet circles, positioned imperatively. A busy graph at 20 Hz
 * would otherwise ask React to reconcile hundreds of elements per second for
 * something that is purely decorative.
 */
const POOL = 48;

interface Packet {
	edgeId: string;
	/** performance.now() at which this packet starts moving. */
	startAt: number;
}

export default function GraphView({ graph, sim }: Props) {
	const pathRefs = useRef(new Map<string, SVGPathElement>());
	const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
	const packets = useRef<(Packet | null)[]>(Array.from({ length: POOL }, () => null));
	const frame = useRef<number | null>(null);

	// Edges grouped by topic, so a publish can light up every wire that carries it.
	const edgesByTopic = useMemo(() => {
		const map = new Map<string, { id: string; inbound: boolean }[]>();
		for (const edge of graph.edges) {
			const list = map.get(edge.topic) ?? [];
			list.push({ id: edge.id, inbound: edge.inbound });
			map.set(edge.topic, list);
		}
		return map;
	}, [graph]);

	useEffect(() => {
		const spawn = (edgeId: string, startAt: number) => {
			const free = packets.current.indexOf(null);
			// Full pool means the graph is already saturated with motion; one more
			// dot would not read anyway, so it is dropped rather than queued.
			if (free === -1) return;
			packets.current[free] = { edgeId, startAt };
		};

		const unsubscribe = sim.on('message', (message) => {
			const now = performance.now();
			for (const edge of edgesByTopic.get(message.topic) ?? []) {
				// Outbound first, inbound one hop later, so a packet reads as travelling
				// node -> topic -> node rather than as two unrelated blips.
				spawn(edge.id, edge.inbound ? now + HOP_MS : now);
			}
			ensureRunning();
		});

		const tick = () => {
			const now = performance.now();
			let live = 0;

			packets.current.forEach((packet, index) => {
				const circle = circleRefs.current[index];
				if (!circle) return;

				if (!packet) {
					circle.style.display = 'none';
					return;
				}

				const elapsed = now - packet.startAt;
				if (elapsed < 0) {
					circle.style.display = 'none';
					live += 1;
					return;
				}
				if (elapsed > HOP_MS) {
					packets.current[index] = null;
					circle.style.display = 'none';
					return;
				}

				const path = pathRefs.current.get(packet.edgeId);
				const length = path?.getTotalLength() ?? 0;
				if (!path || length === 0) {
					packets.current[index] = null;
					circle.style.display = 'none';
					return;
				}

				const point = path.getPointAtLength((elapsed / HOP_MS) * length);
				circle.setAttribute('cx', String(point.x));
				circle.setAttribute('cy', String(point.y));
				circle.style.display = '';
				live += 1;
			});

			if (live === 0) {
				frame.current = null;
				return;
			}
			frame.current = requestAnimationFrame(tick);
		};

		function ensureRunning() {
			if (frame.current === null) frame.current = requestAnimationFrame(tick);
		}

		return () => {
			unsubscribe();
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
			packets.current = Array.from({ length: POOL }, () => null);
		};
	}, [sim, edgesByTopic]);

	if (graph.vertices.length === 0) {
		return (
			<div className="ros-graph-empty">
				Nothing to draw yet.
				<br />
				Add a node and give it a publisher.
			</div>
		);
	}

	return (
		<div className="ros-graph-scroll">
			<div className="ros-graph">
				<svg
					width={graph.width}
					height={graph.height}
					viewBox={`0 0 ${graph.width} ${graph.height}`}
					role="img"
					aria-label="ROS computation graph"
				>
					<defs>
						<marker
							id="ros-arrow"
							viewBox="0 0 8 8"
							refX="7"
							refY="4"
							markerWidth="6"
							markerHeight="6"
							orient="auto-start-reverse"
						>
							<path d="M 0 0 L 8 4 L 0 8 z" fill="#4a4a4a" />
						</marker>
					</defs>

					{graph.edges.map((edge) => (
						<path
							key={edge.id}
							className="ros-graph-edge"
							d={edge.d}
							markerEnd="url(#ros-arrow)"
							ref={(element) => {
								if (element) pathRefs.current.set(edge.id, element);
								else pathRefs.current.delete(edge.id);
							}}
						/>
					))}

					{graph.vertices.map((vertex) => (
						<g
							key={vertex.id}
							className={
								vertex.kind === 'node'
									? `ros-graph-node${vertex.builtin ? ' builtin' : ''}`
									: 'ros-graph-topic'
							}
						>
							<rect x={vertex.x} y={vertex.y} width={vertex.w} height={vertex.h} />
							<text
								x={vertex.x + vertex.w / 2}
								y={vertex.y + vertex.h / 2}
								textAnchor="middle"
								dominantBaseline="central"
							>
								{vertex.label}
							</text>
						</g>
					))}

					{Array.from({ length: POOL }, (_, index) => (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: the pool is fixed length and never reordered, so the index is the stable identity.
							key={index}
							className="ros-graph-packet"
							r={3.5}
							cx={-10}
							cy={-10}
							style={{ display: 'none' }}
							ref={(element) => {
								circleRefs.current[index] = element;
							}}
						/>
					))}
				</svg>
			</div>
		</div>
	);
}
