/**
 * A 2D robot with just enough behaviour to be worth driving.
 *
 * Not a physics engine: pose is integrated from a velocity command, and
 * collision is a circle-vs-axis-aligned-rectangle test that refuses the move
 * rather than resolving it. The laser is five raycasts. All of it is fake, and
 * all of it produces the cause-and-effect a student needs to debug their graph.
 */

import type { LaserScan, Twist } from './types';

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Pose {
	x: number;
	y: number;
	/** Heading in radians; 0 points along +x. */
	theta: number;
}

export interface Arena {
	width: number;
	height: number;
	obstacles: Rect[];
	goal: Rect;
	start: Pose;
}

/** Body radius in metres. The robot draws as a square of roughly this half-width. */
export const ROBOT_RADIUS = 0.28;

/** Ray bearings relative to heading, front first so `ranges[0]` is the obvious one. */
export const SCAN_ANGLES = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 2, -Math.PI / 2];
export const SCAN_RANGE = 4;

/** Velocity ceilings, so a student typing 999 gets a fast robot rather than a teleport. */
const MAX_LINEAR = 1.6;
const MAX_ANGULAR = 2.4;

export class Robot {
	pose: Pose;
	twist: Twist = { linear: 0, angular: 0 };
	scan: LaserScan = { ranges: SCAN_ANGLES.map(() => SCAN_RANGE), angles: SCAN_ANGLES, range: SCAN_RANGE };
	collided = false;
	reachedGoal = false;
	/** Total distance travelled, used by challenge checks. */
	distance = 0;

	constructor(private arena: Arena) {
		this.pose = { ...arena.start };
	}

	setArena(arena: Arena): void {
		this.arena = arena;
		this.reset();
	}

	reset(): void {
		this.pose = { ...this.arena.start };
		this.twist = { linear: 0, angular: 0 };
		this.collided = false;
		this.reachedGoal = false;
		this.distance = 0;
		this.updateScan();
	}

	command(twist: Twist): void {
		this.twist = {
			linear: clamp(twist.linear, -MAX_LINEAR, MAX_LINEAR),
			angular: clamp(twist.angular, -MAX_ANGULAR, MAX_ANGULAR),
		};
	}

	step(dt: number): void {
		const theta = this.pose.theta + this.twist.angular * dt;
		const dx = this.twist.linear * Math.cos(theta) * dt;
		const dy = this.twist.linear * Math.sin(theta) * dt;

		// Slide along whatever it touches rather than stopping dead. A square body
		// clipping a corner that its forward ray missed is a normal thing for a
		// student's first controller to do, and freezing there — commanding full
		// speed while going nowhere — reads as a broken page, not as feedback.
		let x = this.pose.x;
		let y = this.pose.y;
		let hit = false;

		if (!this.blocked(x + dx, y + dy)) {
			x += dx;
			y += dy;
		} else {
			hit = true;
			if (!this.blocked(x + dx, y)) x += dx;
			if (!this.blocked(x, y + dy)) y += dy;
		}

		this.distance += Math.hypot(x - this.pose.x, y - this.pose.y);
		this.pose = { x, y, theta };
		this.collided = hit;

		this.updateScan();

		const { goal } = this.arena;
		if (
			this.pose.x > goal.x &&
			this.pose.x < goal.x + goal.w &&
			this.pose.y > goal.y &&
			this.pose.y < goal.y + goal.h
		) {
			this.reachedGoal = true;
		}
	}

	private blocked(x: number, y: number): boolean {
		const { width, height, obstacles } = this.arena;
		if (x < ROBOT_RADIUS || y < ROBOT_RADIUS) return true;
		if (x > width - ROBOT_RADIUS || y > height - ROBOT_RADIUS) return true;
		return obstacles.some((r) => circleHitsRect(x, y, ROBOT_RADIUS, r));
	}

	private updateScan(): void {
		const ranges = SCAN_ANGLES.map((a) => this.castRay(this.pose.theta + a));
		this.scan = { ranges, angles: SCAN_ANGLES, range: SCAN_RANGE };
	}

	/**
	 * Marching raycast. Stepping along the ray is less code than analytic
	 * slab intersection and the 4 cm step is far below anything a student can
	 * perceive on screen.
	 */
	private castRay(angle: number): number {
		const step = 0.04;
		const dx = Math.cos(angle) * step;
		const dy = Math.sin(angle) * step;
		let x = this.pose.x;
		let y = this.pose.y;

		for (let travelled = 0; travelled < SCAN_RANGE; travelled += step) {
			x += dx;
			y += dy;
			if (x <= 0 || y <= 0 || x >= this.arena.width || y >= this.arena.height) return travelled;
			if (this.arena.obstacles.some((r) => pointInRect(x, y, r))) return travelled;
		}
		return SCAN_RANGE;
	}
}

function pointInRect(x: number, y: number, r: Rect): boolean {
	return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function circleHitsRect(x: number, y: number, radius: number, r: Rect): boolean {
	const nearestX = clamp(x, r.x, r.x + r.w);
	const nearestY = clamp(y, r.y, r.y + r.h);
	return Math.hypot(x - nearestX, y - nearestY) < radius;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
