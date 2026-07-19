/**
 * Sparkline — SVG mini line chart for round scores.
 * 60×20px, no axes, just the trend line.
 * Green if improving (scores going down), red if getting worse.
 */

interface SparklineProps {
  scores: (number | null)[];
  par?: number;
  width?: number;
  height?: number;
}

export default function Sparkline({
  scores,
  par = 72,
  width = 60,
  height = 20,
}: SparklineProps) {
  const valid = scores.filter((s): s is number => s != null);

  if (valid.length < 2) {
    return (
      <svg width={width} height={height} className="inline-block align-middle opacity-30">
        <line
          x1="2"
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  // Determine if improving (scores decreasing) or worsening
  const first = valid[0];
  const last = valid[valid.length - 1];
  const improving = last < first;
  const color = improving ? "#16a34a" : last > first ? "#dc2626" : "#94a3b8";

  // Calculate points
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = valid.map((score, i) => {
    const x = 2 + (i / (valid.length - 1)) * (width - 4);
    // Invert Y so lower scores are higher on chart (better = up)
    const y = 2 + ((score - min) / range) * (height - 4);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block align-middle"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="1.5"
        fill={color}
      />
    </svg>
  );
}
