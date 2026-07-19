/**
 * PositionIndicator — Shows projected position movement.
 * Green ▲ (moving up), red ▼ (moving down), → (steady).
 */

interface PositionIndicatorProps {
  currentPosition: number;
  projectedPosition?: number;
}

export default function PositionIndicator({
  currentPosition,
  projectedPosition,
}: PositionIndicatorProps) {
  if (projectedPosition == null || projectedPosition === 0) {
    return <span className="text-zinc-300 dark:text-zinc-600">→</span>;
  }

  // Lower position number = better rank
  const diff = currentPosition - projectedPosition;

  if (diff > 0) {
    // Projected to move up (lower number)
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 font-semibold text-xs">
        ▲{diff > 1 ? diff : ""}
      </span>
    );
  } else if (diff < 0) {
    // Projected to move down
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500 font-semibold text-xs">
        ▼{Math.abs(diff) > 1 ? Math.abs(diff) : ""}
      </span>
    );
  }

  return <span className="text-zinc-300 dark:text-zinc-600">→</span>;
}
