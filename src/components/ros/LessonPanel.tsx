import { LESSONS, SANDBOX, type Lesson } from '../../lib/ros-sim/lessons';

interface Props {
	lesson: Lesson;
	index: number;
	completed: Set<string>;
	/** True once the current lesson's check has passed in this run. */
	passed: boolean;
	onSelect: (index: number) => void;
}

/** Index used for the sandbox entry, which sits just past the last lesson. */
const SANDBOX_INDEX = LESSONS.length;

export default function LessonPanel({ lesson, index, completed, passed, onSelect }: Props) {
	const isSandbox = lesson.id === SANDBOX.id;
	const number = isSandbox ? '∞' : String(index + 1).padStart(2, '0');

	return (
		<div className="ros-lesson">
			<span className="ros-lesson-eyebrow">
				{isSandbox ? 'Free play' : `Lesson ${number} of ${LESSONS.length}`}
			</span>
			<h2>{lesson.title}</h2>
			<p className="ros-lesson-concept">{lesson.concept}</p>

			<ol className="ros-lesson-brief">
				{lesson.brief.map((step) => (
					<li key={step}>{step}</li>
				))}
			</ol>

			{!isSandbox && (
				<div className={`ros-lesson-goal${passed ? ' done' : ''}`}>
					<span className="marker" aria-hidden="true">
						{passed ? '✓' : '▸'}
					</span>
					<span>
						<strong>Challenge.</strong> {lesson.goal}
					</span>
				</div>
			)}

			<div className="ros-lesson-nav">
				<div className="ros-steps">
					{LESSONS.map((entry, entryIndex) => (
						<button
							type="button"
							key={entry.id}
							className={`ros-step${entryIndex === index ? ' current' : ''}${
								completed.has(entry.id) ? ' done' : ''
							}`}
							aria-label={`Lesson ${entryIndex + 1}: ${entry.title}${
								completed.has(entry.id) ? ' (completed)' : ''
							}`}
							aria-current={entryIndex === index ? 'step' : undefined}
							onClick={() => onSelect(entryIndex)}
						>
							{entryIndex + 1}
						</button>
					))}
					<button
						type="button"
						className={`ros-step${isSandbox ? ' current' : ''}`}
						aria-label="Sandbox: free play with every block"
						onClick={() => onSelect(SANDBOX_INDEX)}
					>
						∞
					</button>
				</div>

				<button
					type="button"
					className="ros-btn"
					disabled={index >= SANDBOX_INDEX}
					onClick={() => onSelect(Math.min(index + 1, SANDBOX_INDEX))}
				>
					Next →
				</button>
			</div>
		</div>
	);
}
