import { useId } from 'react';

import { CMD_VEL, SCAN } from '../../lib/ros-sim/types';

interface Props {
	value: string;
	onChange: (topic: string) => void;
	known: string[];
	label: string;
}

/**
 * Free-text topic name with suggestions.
 *
 * Deliberately not a dropdown of valid topics: in ROS a topic exists because
 * somebody named it, and a typo produces a second, lonely topic rather than an
 * error. The graph makes that visible, which is a lesson worth keeping.
 */
export default function TopicInput({ value, onChange, known, label }: Props) {
	const listId = useId();
	const suggestions = [...new Set([CMD_VEL, SCAN, ...known])].sort();

	return (
		<>
			<input
				className="ros-input text ros-select topic"
				value={value}
				list={listId}
				spellCheck={false}
				aria-label={label}
				onChange={(event) => onChange(event.target.value)}
			/>
			<datalist id={listId}>
				{suggestions.map((topic) => (
					<option key={topic} value={topic} />
				))}
			</datalist>
		</>
	);
}
