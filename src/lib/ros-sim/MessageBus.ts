/**
 * An in-memory stand-in for ROS middleware.
 *
 * Real ROS discovers peers over DDS and delivers asynchronously. Here, publish
 * is a synchronous fan-out over a Map. The mental model a student needs — a
 * publisher does not know who is listening, and a topic is just a name — is
 * preserved exactly; the transport is not.
 */

import type { MessagePayload, MessageType, ROSMessage } from './types';
import { typeOfTopic } from './types';

export type SubscriberFn = (message: ROSMessage) => void;

interface Subscription {
	nodeId: string;
	topic: string;
	fn: SubscriberFn;
}

export class MessageBus {
	private subscriptions: Subscription[] = [];
	private seq = 0;
	/** Latest message per topic, so a subscriber can read without having ticked yet. */
	private latest = new Map<string, ROSMessage>();
	/** Fired for every delivery so the graph can animate a packet. */
	private observers: ((message: ROSMessage) => void)[] = [];

	subscribe(nodeId: string, topic: string, fn: SubscriberFn): () => void {
		const sub: Subscription = { nodeId, topic, fn };
		this.subscriptions.push(sub);
		return () => {
			this.subscriptions = this.subscriptions.filter((s) => s !== sub);
		};
	}

	observe(fn: (message: ROSMessage) => void): () => void {
		this.observers.push(fn);
		return () => {
			this.observers = this.observers.filter((o) => o !== fn);
		};
	}

	publish(from: string, topic: string, payload: MessagePayload, stamp: number): ROSMessage {
		this.seq += 1;
		const type: MessageType = typeOfTopic(topic);
		const message: ROSMessage = { topic, type, payload, from, stamp, seq: this.seq };

		this.latest.set(topic, message);
		for (const observer of this.observers) observer(message);

		// Copied first: a callback that subscribes or unsubscribes must not
		// disturb the delivery currently in flight.
		for (const sub of [...this.subscriptions]) {
			if (sub.topic === topic) sub.fn(message);
		}

		return message;
	}

	/** Most recent message on a topic, or null if nothing has been published yet. */
	read(topic: string): ROSMessage | null {
		return this.latest.get(topic) ?? null;
	}

	/** Node ids currently subscribed to a topic — used to draw graph edges. */
	subscribersOf(topic: string): string[] {
		return [...new Set(this.subscriptions.filter((s) => s.topic === topic).map((s) => s.nodeId))];
	}

	reset(): void {
		this.subscriptions = [];
		this.latest.clear();
		this.seq = 0;
	}
}
