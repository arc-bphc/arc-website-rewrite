import { useEffect, useRef, useState } from 'react';

import type { LogLine, Simulation } from '../../lib/ros-sim/Simulation';
import { formatPayload } from '../../lib/ros-sim/types';

interface Props {
	sim: Simulation;
	/** Mirror live topic traffic into the console, throttled per topic. */
	showTraffic: boolean;
}


const MAX_LINES = 200;

const FLUSH_MS = 120;

const TRAFFIC_MS = 500;

export default function ConsoleView({ sim, showTraffic }: Props) {
	const [lines, setLines] = useState<LogLine[]>([]);
	const pending = useRef<LogLine[]>([]);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const pinned = useRef(true);

	useEffect(() => {
		// Log events can arrive many times per simulation tick. Batching keeps the
		// console from driving a React render per line.
		const push = (line: LogLine) => pending.current.push(line);

		const unsubscribeLog = sim.on('log', push);

		const lastSeen = new Map<string, number>();
		let trafficSeq = -1;
		const unsubscribeMessage = sim.on('message', (message) => {
			if (!showTraffic) return;
			const now = performance.now();
			const previous = lastSeen.get(message.topic) ?? Number.NEGATIVE_INFINITY;
			if (now - previous < TRAFFIC_MS) return;
			lastSeen.set(message.topic, now);
			push({
				id: trafficSeq,
				level: 'topic',
				text: `${message.topic}  ${formatPayload(message.payload)}`,
				time: message.stamp,
			});
			trafficSeq -= 1;
		});

		const timer = window.setInterval(() => {
			if (pending.current.length === 0) return;
			const batch = pending.current;
			pending.current = [];
			setLines((current) => [...current, ...batch].slice(-MAX_LINES));
		}, FLUSH_MS);

		return () => {
			unsubscribeLog();
			unsubscribeMessage();
			window.clearInterval(timer);
		};
	}, [sim, showTraffic]);

	// Follow the tail unless the student has scrolled up to read something.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `lines` is the trigger, not a value read here — the effect must run after every flush.
	useEffect(() => {
		const body = bodyRef.current;
		if (body && pinned.current) body.scrollTop = body.scrollHeight;
	}, [lines]);

	const handleScroll = () => {
		const body = bodyRef.current;
		if (!body) return;
		pinned.current = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
	};

	return (
		<div
			className="ros-panel-body ros-console-body"
			ref={bodyRef}
			onScroll={handleScroll}
			role="log"
			aria-live="polite"
			aria-label="simulation console"
		>
			{lines.length === 0 && (
				<span className="ros-console-empty">Console output appears here once you press Run.</span>
			)}

			{lines.map((line) => (
				<div className={`ros-console-line ${line.level}`} key={line.id}>
					<span className="ros-console-time">{line.time.toFixed(1)}s</span>
					<span className="ros-console-text">{line.text}</span>
				</div>
			))}
		</div>
	);
}
