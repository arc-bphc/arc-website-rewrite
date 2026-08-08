"use client"

import { useEffect, useRef } from "react"

import "../../styles/globals.css"

/**
 * Background manipulator for the About section.
 *
 * The arm is a two-link planar chain solved with closed-form inverse
 * kinematics (law of cosines), so the gripper lands exactly on the cursor
 * instead of chasing it with a stack of eased transforms. The solved pose is
 * written straight onto the SVG nodes inside a rAF loop — React renders the
 * markup once and never re-reconciles while tracking.
 */

const VIEW_W = 1200
const VIEW_H = 720

/** Shoulder pivot, in viewBox units. */
const BASE = { x: 1015, y: 618 }
const UPPER_ARM = 300
const FOREARM = 250

/** Keep the solver away from the fully-folded and fully-locked singularities. */
const REACH_MIN = Math.abs(UPPER_ARM - FOREARM) + 12
const REACH_MAX = UPPER_ARM + FOREARM - 12

/**
 * Workspace limit. Without it, a pointer below or to the right of the plinth
 * swings the elbow-up solution down through the deck and off the right edge.
 * These bounds keep every solved pose inside the viewBox and above the deck.
 */
const LIMIT_X = BASE.x - 80
const LIMIT_Y = BASE.y - 60

/** Where the arm sweeps when the pointer has gone quiet. */
const HOME = { x: 690, y: 290 }
const IDLE_AFTER_MS = 2200

/** Per-frame fraction of the remaining distance the tip closes. */
const FOLLOW = 0.075

interface Pose {
	elbowX: number
	elbowY: number
	tipX: number
	tipY: number
	/** Forearm heading in degrees, used to aim the gripper. */
	wrist: number
}

function solve(targetX: number, targetY: number): Pose {
	let dx = Math.min(targetX, LIMIT_X) - BASE.x
	let dy = Math.min(targetY, LIMIT_Y) - BASE.y
	let dist = Math.hypot(dx, dy)

	if (dist < 0.001) {
		dx = -1
		dy = -1
		dist = Math.SQRT2
	}

	// Pull the goal onto the annulus the arm can physically reach.
	const reach = Math.min(Math.max(dist, REACH_MIN), REACH_MAX)
	const tipX = BASE.x + (dx / dist) * reach
	const tipY = BASE.y + (dy / dist) * reach

	const heading = Math.atan2(tipY - BASE.y, tipX - BASE.x)
	const cosine = (reach * reach + UPPER_ARM * UPPER_ARM - FOREARM * FOREARM) / (2 * reach * UPPER_ARM)
	const shoulder = heading + Math.acos(Math.min(1, Math.max(-1, cosine))) // elbow-up solution

	const elbowX = BASE.x + Math.cos(shoulder) * UPPER_ARM
	const elbowY = BASE.y + Math.sin(shoulder) * UPPER_ARM

	return {
		elbowX,
		elbowY,
		tipX,
		tipY,
		wrist: (Math.atan2(tipY - elbowY, tipX - elbowX) * 180) / Math.PI,
	}
}

export default function RoboticArm({ className = "" }: { className?: string }) {
	const svgRef = useRef<SVGSVGElement>(null)
	const upperRef = useRef<SVGGElement>(null)
	const forearmRef = useRef<SVGGElement>(null)
	const elbowRef = useRef<SVGGElement>(null)
	const gripperRef = useRef<SVGGElement>(null)
	const reticleRef = useRef<SVGGElement>(null)
	const cableRef = useRef<SVGPathElement>(null)

	useEffect(() => {
		const svg = svgRef.current
		if (!svg) return

		const paint = (pose: Pose) => {
			upperRef.current?.setAttribute(
				"transform",
				`translate(${BASE.x} ${BASE.y}) rotate(${(Math.atan2(pose.elbowY - BASE.y, pose.elbowX - BASE.x) * 180) / Math.PI})`,
			)
			forearmRef.current?.setAttribute(
				"transform",
				`translate(${pose.elbowX} ${pose.elbowY}) rotate(${pose.wrist})`,
			)
			elbowRef.current?.setAttribute("transform", `translate(${pose.elbowX} ${pose.elbowY})`)
			gripperRef.current?.setAttribute(
				"transform",
				`translate(${pose.tipX} ${pose.tipY}) rotate(${pose.wrist})`,
			)
			reticleRef.current?.setAttribute("transform", `translate(${pose.tipX} ${pose.tipY})`)

			// Loom sagging from the plinth to the elbow housing.
			const sagX = (BASE.x + pose.elbowX) / 2 + 34
			const sagY = (BASE.y + pose.elbowY) / 2 + 58
			cableRef.current?.setAttribute(
				"d",
				`M ${BASE.x + 30} ${BASE.y - 46} Q ${sagX} ${sagY} ${pose.elbowX + 12} ${pose.elbowY + 10}`,
			)
		}

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
		if (reduceMotion.matches) {
			paint(solve(HOME.x, HOME.y))
			return
		}

		// Pointer position in client space; converted to viewBox units once per
		// frame so a busy mousemove never triggers a layout read.
		const pointer = { x: 0, y: 0 }
		let pointerSeen = false
		let lastMove = 0

		const current = { ...HOME }
		let visible = false
		let frame = 0

		const tick = (now: number) => {
			frame = requestAnimationFrame(tick)

			let targetX: number
			let targetY: number

			if (pointerSeen && now - lastMove < IDLE_AFTER_MS) {
				const screenToView = svg.getScreenCTM()?.inverse()
				const local = screenToView
					? new DOMPoint(pointer.x, pointer.y).matrixTransform(screenToView)
					: HOME
				targetX = local.x
				targetY = local.y
			} else {
				// Slow lissajous sweep so the arm still looks powered on.
				const t = now / 1000
				targetX = HOME.x + Math.cos(t * 0.41) * 215
				targetY = HOME.y + Math.sin(t * 0.62) * 125
			}

			current.x += (targetX - current.x) * FOLLOW
			current.y += (targetY - current.y) * FOLLOW
			paint(solve(current.x, current.y))
		}

		const onMove = (event: PointerEvent) => {
			pointer.x = event.clientX
			pointer.y = event.clientY
			pointerSeen = true
			lastMove = performance.now()
		}

		const start = () => {
			if (visible) return
			visible = true
			window.addEventListener("pointermove", onMove, { passive: true })
			frame = requestAnimationFrame(tick)
		}

		const stop = () => {
			if (!visible) return
			visible = false
			window.removeEventListener("pointermove", onMove)
			cancelAnimationFrame(frame)
		}

		// Nothing to animate while the section is scrolled out of view.
		const observer = new IntersectionObserver(
			([entry]) => (entry.isIntersecting ? start() : stop()),
			{ rootMargin: "120px" },
		)
		observer.observe(svg)

		paint(solve(HOME.x, HOME.y))

		return () => {
			observer.disconnect()
			stop()
		}
	}, [])

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
			className={`pointer-events-none select-none ${className}`}
			style={{ color: "var(--primary)" }}
		>
			<defs>
				<pattern id="arm-grid" width="48" height="48" patternUnits="userSpaceOnUse">
					<path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" opacity=".06" />
				</pattern>
				{/* Holds the full working area and only softens the outer edges, so the
				    gripper stays legible wherever it reaches. */}
				<radialGradient id="arm-fade" cx="58%" cy="70%" r="95%">
					<stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
					<stop offset="58%" stopColor="#ffffff" stopOpacity="1" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</radialGradient>
				<mask id="arm-vignette">
					<rect width={VIEW_W} height={VIEW_H} fill="url(#arm-fade)" />
				</mask>
			</defs>

			<rect width={VIEW_W} height={VIEW_H} fill="url(#arm-grid)" mask="url(#arm-vignette)" />

			<g mask="url(#arm-vignette)">
				{/* Deck the plinth is bolted to */}
				<line
					x1="380"
					y1={BASE.y + 72}
					x2={VIEW_W}
					y2={BASE.y + 72}
					stroke="currentColor"
					strokeWidth="2"
					opacity=".28"
				/>

				<path
					ref={cableRef}
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					opacity=".16"
				/>

				{/* Plinth */}
				<g stroke="currentColor" fill="none" opacity=".3">
					<path
						d={`M ${BASE.x - 52} ${BASE.y - 4} L ${BASE.x - 36} ${BASE.y - 58} L ${BASE.x + 36} ${BASE.y - 58} L ${BASE.x + 52} ${BASE.y - 4} Z`}
						strokeWidth="4"
					/>
					<rect x={BASE.x - 78} y={BASE.y - 4} width="156" height="26" strokeWidth="4" />
					<rect x={BASE.x - 60} y={BASE.y + 22} width="120" height="50" strokeWidth="2" opacity=".6" />
					<line x1={BASE.x - 40} y1={BASE.y + 36} x2={BASE.x + 40} y2={BASE.y + 36} strokeWidth="2" opacity=".5" />
					<line x1={BASE.x - 40} y1={BASE.y + 50} x2={BASE.x + 12} y2={BASE.y + 50} strokeWidth="2" opacity=".5" />
				</g>

				{/* Upper arm — drawn along +x and rotated into place */}
				<g ref={upperRef}>
					<rect
						x="0"
						y="-19"
						width={UPPER_ARM}
						height="38"
						rx="19"
						fill="currentColor"
						fillOpacity=".07"
						stroke="currentColor"
						strokeWidth="4"
						opacity=".52"
					/>
					<line
						x1="34"
						y1="0"
						x2={UPPER_ARM - 34}
						y2="0"
						stroke="currentColor"
						strokeWidth="2"
						strokeDasharray="14 10"
						opacity=".3"
					/>
				</g>

				{/* Forearm */}
				<g ref={forearmRef}>
					<rect
						x="0"
						y="-14"
						width={FOREARM}
						height="28"
						rx="14"
						fill="currentColor"
						fillOpacity=".07"
						stroke="currentColor"
						strokeWidth="4"
						opacity=".52"
					/>
					<line
						x1="28"
						y1="0"
						x2={FOREARM - 28}
						y2="0"
						stroke="currentColor"
						strokeWidth="2"
						strokeDasharray="10 8"
						opacity=".3"
					/>
				</g>

				{/* Shoulder servo */}
				<g opacity=".7">
					<circle cx={BASE.x} cy={BASE.y} r="26" fill="#0d0d0d" stroke="currentColor" strokeWidth="4" />
					<circle cx={BASE.x} cy={BASE.y} r="8" fill="currentColor" opacity=".7" />
				</g>

				{/* Elbow servo */}
				<g ref={elbowRef} opacity=".7">
					<circle r="21" fill="#0d0d0d" stroke="currentColor" strokeWidth="4" />
					<circle r="6" fill="currentColor" opacity=".7" />
				</g>

				{/* Wrist and gripper */}
				<g ref={gripperRef} opacity=".8">
					<rect x="-16" y="-15" width="30" height="30" rx="6" fill="#0d0d0d" stroke="currentColor" strokeWidth="4" />
					<path d="M 12 -12 L 34 -20 L 40 -8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M 12 12 L 34 20 L 40 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
				</g>

				{/* End-effector reticle */}
				<g ref={reticleRef} className="animate-pulse">
					<circle r="34" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 11" opacity=".5" />
					<circle r="3.5" fill="currentColor" opacity=".8" />
					<g stroke="currentColor" strokeWidth="2" opacity=".55">
						<line x1="-50" y1="0" x2="-40" y2="0" />
						<line x1="40" y1="0" x2="50" y2="0" />
						<line x1="0" y1="-50" x2="0" y2="-40" />
						<line x1="0" y1="40" x2="0" y2="50" />
					</g>
				</g>
			</g>
		</svg>
	)
}
