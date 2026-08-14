import type { ChangeEvent } from 'react';

import { type Expr, type SensorField, SENSOR_FIELDS, field, num } from '../../lib/ros-sim/program';

interface Props {
	value: Expr;
	onChange: (next: Expr) => void;
	label: string;
	/** Sensor sources are hidden where only a constant makes sense. */
	allowSensors?: boolean;
	step?: number;
}

/**
 * One value slot in a block.
 *
 * A slot is either a typed constant or a reading off /scan, and the dropdown is
 * the whole story: picking a sensor is how a student discovers that a block can
 * be driven by live data instead of a number.
 */
export default function ExprInput({ value, onChange, label, allowSensors = true, step = 0.1 }: Props) {
	const source = value.kind === 'number' ? 'value' : value.source;

	const handleSource = (event: ChangeEvent<HTMLSelectElement>) => {
		const next = event.target.value;
		onChange(next === 'value' ? num(0) : field(next as SensorField));
	};

	const handleNumber = (event: ChangeEvent<HTMLInputElement>) => {
		const parsed = Number.parseFloat(event.target.value);
		onChange(num(Number.isFinite(parsed) ? parsed : 0));
	};

	return (
		<>
			{allowSensors && (
				<select
					className="ros-select"
					value={source}
					onChange={handleSource}
					aria-label={`${label} source`}
				>
					<option value="value">value</option>
					{SENSOR_FIELDS.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>
			)}

			{value.kind === 'number' && (
				<input
					className="ros-input num"
					type="number"
					step={step}
					value={value.value}
					onChange={handleNumber}
					aria-label={label}
				/>
			)}
		</>
	);
}
