import { useEffect, useRef } from 'react';

import type { Arena } from '../../lib/ros-sim/Robot';
import { ROBOT_RADIUS } from '../../lib/ros-sim/Robot';
import type { Simulation } from '../../lib/ros-sim/Simulation';

interface Props {
	sim: Simulation;
	arena: Arena;
}

const COLOURS = {
	ground: '#0d0d0d',
	grid: 'rgba(255, 255, 255, .04)',
	wall: '#3a3a3a',
	obstacle: '#1e1e1e',
	obstacleEdge: '#3f3f3f',
	robot: '#ffffff',
	robotEdge: '#0b0b0b',
	ray: 'rgba(110, 231, 249, .28)',
	rayHit: 'rgba(110, 231, 249, .85)',
	goal: '#ccff00',
	collision: '#ff6b6b',
};

/**
 * The arena, drawn straight to a canvas from the simulation's mutable state.
 *
 * This component renders once. Everything that moves is painted from its own
 * animation frame, so driving the robot costs React nothing.
 */
export default function RobotView({ sim, arena }: Props) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const statsRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext('2d');
		if (!context) return;

		let frame = 0;
		let width = 0;
		let height = 0;
		let scale = 1;

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			if (rect.width === 0) return;
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			width = rect.width;
			height = (rect.width * arena.height) / arena.width;
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			canvas.style.height = `${height}px`;
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			scale = width / arena.width;
		};

		// World y points up; canvas y points down.
		const px = (x: number) => x * scale;
		const py = (y: number) => height - y * scale;

		const draw = () => {
			const { robot } = sim;

			context.fillStyle = COLOURS.ground;
			context.fillRect(0, 0, width, height);

			context.strokeStyle = COLOURS.grid;
			context.lineWidth = 1;
			context.beginPath();
			for (let x = 1; x < arena.width; x += 1) {
				context.moveTo(px(x), 0);
				context.lineTo(px(x), height);
			}
			for (let y = 1; y < arena.height; y += 1) {
				context.moveTo(0, py(y));
				context.lineTo(width, py(y));
			}
			context.stroke();

			// Goal, drawn under everything else so the robot passes over it.
			const { goal } = arena;
			context.save();
			context.setLineDash([5, 4]);
			context.strokeStyle = COLOURS.goal;
			context.fillStyle = 'rgba(204, 255, 0, .1)';
			context.lineWidth = 1.5;
			context.fillRect(px(goal.x), py(goal.y + goal.h), px(goal.w), goal.h * scale);
			context.strokeRect(px(goal.x), py(goal.y + goal.h), px(goal.w), goal.h * scale);
			context.restore();


			context.fillStyle = COLOURS.obstacle;
			context.strokeStyle = COLOURS.obstacleEdge;
			context.lineWidth = 1;
			for (const rect of arena.obstacles) {
				const x = px(rect.x);
				const y = py(rect.y + rect.h);
				context.fillRect(x, y, px(rect.w), rect.h * scale);
				context.strokeRect(x, y, px(rect.w), rect.h * scale);
			}

			context.strokeStyle = COLOURS.wall;
			context.lineWidth = 2;
			context.strokeRect(1, 1, width - 2, height - 2);

			// Laser rays, so /scan is something the student can see rather than trust.
			const { pose, scan } = robot;
			context.lineWidth = 1;
			scan.angles.forEach((angle, index) => {
				const distance = scan.ranges[index] ?? scan.range;
				const bearing = pose.theta + angle;
				const endX = pose.x + Math.cos(bearing) * distance;
				const endY = pose.y + Math.sin(bearing) * distance;
				const hit = distance < scan.range - 0.01;

				context.strokeStyle = hit ? COLOURS.rayHit : COLOURS.ray;
				context.beginPath();
				context.moveTo(px(pose.x), py(pose.y));
				context.lineTo(px(endX), py(endY));
				context.stroke();

				if (hit) {
					context.fillStyle = COLOURS.rayHit;
					context.beginPath();
					context.arc(px(endX), py(endY), 2.5, 0, Math.PI * 2);
					context.fill();
				}
			});

			const side = ROBOT_RADIUS * 2 * scale;
			context.save();
			context.translate(px(pose.x), py(pose.y));
			// Negated because the canvas y axis is flipped relative to the world.
			context.rotate(-pose.theta);
			context.fillStyle = COLOURS.robot;
			context.fillRect(-side / 2, -side / 2, side, side);
			if (robot.collided) {
				context.strokeStyle = COLOURS.collision;
				context.lineWidth = 2.5;
				context.strokeRect(-side / 2 - 2, -side / 2 - 2, side + 4, side + 4);
			}
			// Heading marker, so a stationary robot still shows which way it faces.
			context.fillStyle = COLOURS.robotEdge;
			context.fillRect(side / 2 - side * 0.22, -side * 0.12, side * 0.22, side * 0.24);
			context.restore();

			if (statsRef.current) {
				statsRef.current.textContent = '';
				statsRef.current.append(
					stat('x', `${pose.x.toFixed(2)} m`),
					stat('y', `${pose.y.toFixed(2)} m`),
					stat('θ', `${((pose.theta * 180) / Math.PI).toFixed(0)}°`),
					stat('linear', `${robot.twist.linear.toFixed(2)} m/s`),
					stat('angular', `${robot.twist.angular.toFixed(2)} rad/s`),
				);
			}
		};

		// A paused arena is a still image; repainting it every frame would keep a
		// laptop's GPU busy for nothing during the parts of the workshop where
		// students are reading rather than running.
		let lastKey = '';
		const loop = () => {
			const { pose, twist, collided } = sim.robot;
			const key = `${pose.x};${pose.y};${pose.theta};${twist.linear};${twist.angular};${collided}`;
			if (key !== lastKey) {
				lastKey = key;
				draw();
			}
			frame = requestAnimationFrame(loop);
		};

		const observer = new ResizeObserver(() => {
			resize();
			draw();
		});
		observer.observe(canvas);

		resize();
		loop();

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [sim, arena]);

	return (
		<>
			<canvas ref={canvasRef} className="ros-arena" aria-label="robot arena" />
			<div className="ros-arena-foot" ref={statsRef} />
		</>
	);
}

function stat(label: string, value: string): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.textContent = `${label} `;
	const strong = document.createElement('b');
	strong.textContent = value;
	wrapper.append(strong);
	return wrapper;
}
