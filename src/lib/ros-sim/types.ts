/**
 * The vocabulary of the teaching simulator.
 *
 * None of this is real ROS. It is the smallest set of ideas a fresher needs in
 * order to read a real ROS graph later: a node runs code, a publisher writes to
 * a named topic, a subscriber reads from one, and a message is the thing that
 * travels. Everything below is deliberately synchronous and in-memory.
 */

/** Message shapes the workshop knows about, keyed the way ROS names them. */
export type MessageType = 'geometry_msgs/Twist' | 'sensor_msgs/LaserScan' | 'std_msgs/Float64';

/** Velocity command. `linear` is m/s forward, `angular` is rad/s counter-clockwise. */
export interface Twist {
	linear: number;
	angular: number;
}

/** A deliberately tiny laser scan: five fixed bearings instead of 360 samples. */
export interface LaserScan {
	/** Distance in metres per ray, clamped to `range`. */
	ranges: number[];
	/** Bearing of each ray relative to the robot's heading, in radians. */
	angles: number[];
	/** Maximum reportable distance; a ray that hits nothing reads exactly this. */
	range: number;
}

export interface Float64 {
	data: number;
}

export type MessagePayload = Twist | LaserScan | Float64;

export interface ROSMessage<T extends MessagePayload = MessagePayload> {
	topic: string;
	type: MessageType;
	payload: T;
	/** Publishing node id, so the graph can animate the correct edge. */
	from: string;
	/** Simulation clock in seconds. */
	stamp: number;
	/** Monotonic id, used as a React key for in-flight packets. */
	seq: number;
}

/** Well-known topics the built-in robot owns. */
export const CMD_VEL = '/cmd_vel';
export const SCAN = '/scan';

/** Node id of the built-in robot. Students never edit this node. */
export const ROBOT_NODE = 'robot';

/** Which message type a topic carries. Unknown topics default to Float64. */
export function typeOfTopic(topic: string): MessageType {
	if (topic === CMD_VEL) return 'geometry_msgs/Twist';
	if (topic === SCAN) return 'sensor_msgs/LaserScan';
	return 'std_msgs/Float64';
}

/** A blank payload of the right shape, used when a publish block has no value yet. */
export function emptyPayload(type: MessageType): MessagePayload {
	switch (type) {
		case 'geometry_msgs/Twist':
			return { linear: 0, angular: 0 };
		case 'sensor_msgs/LaserScan':
			return { ranges: [], angles: [], range: 0 };
		default:
			return { data: 0 };
	}
}

/** Human-readable one-liner for the console. */
export function formatPayload(payload: MessagePayload): string {
	if ('ranges' in payload) {
		return `ranges: [${payload.ranges.map((r) => r.toFixed(2)).join(', ')}]`;
	}
	if ('linear' in payload) {
		return `linear: ${payload.linear.toFixed(2)}, angular: ${payload.angular.toFixed(2)}`;
	}
	return `data: ${payload.data.toFixed(2)}`;
}
