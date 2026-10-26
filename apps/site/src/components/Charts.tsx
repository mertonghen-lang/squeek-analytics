import { useState } from "react";

export interface ChartPoint {
  x: number;
  y: number | null;
  title: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: ChartPoint[];
}

function extent(values: number[]): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const floor = min >= 0 ? Math.max(0, min - 1) : min - 1;
    return { min: floor, max: max + 1 };
  }
  const pad = (max - min) * 0.08;
  const lo = min - pad;
  return { min: min >= 0 && lo < 0 ? 0 : lo, max: max + pad };
}

export function LineChart({
  series,
  ariaLabel,
  formatY,
  formatX,
}: {
  series: ChartSeries[];
  ariaLabel: string;
  formatY: (value: number) => string;
  formatX?: (value: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const width = 720;
  const height = 260;
  const pad = { l: 58, r: 12, t: 16, b: 28 };
  const xs = series.flatMap((item) => item.points.map((point) => point.x));
  const ys = series.flatMap((item) => item.points.flatMap((point) => (point.y == null ? [] : [point.y])));
  if (xs.length === 0 || ys.length === 0) {
    return <p className="text-sm text-muted">No plotted points in this range.</p>;
  }
  const xExtent = extent(xs);
  const yExtent = extent(ys);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xOf = (value: number) => pad.l + ((value - xExtent.min) / (xExtent.max - xExtent.min)) * plotW;
  const yOf = (value: number) => pad.t + (1 - (value - yExtent.min) / (yExtent.max - yExtent.min)) * plotH;
  const ticks = [0, 0.5, 1].map((t) => yExtent.min + (yExtent.max - yExtent.min) * t);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={yOf(tick) + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
              {formatY(tick)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          let penDown = false;
          let path = "";
          for (const point of item.points) {
            if (point.y == null) {
              penDown = false;
              continue;
            }
            path += `${penDown ? "L" : "M"}${xOf(point.x).toFixed(2)} ${yOf(point.y).toFixed(2)} `;
            penDown = true;
          }
          return (
            <path
              key={item.id}
              d={path}
              fill="none"
              stroke={item.color}
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={item.dashed ? "5 4" : undefined}
            />
          );
        })}
        {series.flatMap((item) =>
          item.points.flatMap((point) => {
            if (point.y == null) return [];
            const key = `${item.id}-${point.x}`;
            return [
              <circle
                key={key}
                cx={xOf(point.x)}
                cy={yOf(point.y)}
                r={hover === key ? 5 : 3}
                fill={item.color}
                onMouseEnter={() => setHover(point.title)}
              >
                <title>{point.title}</title>
              </circle>,
            ];
          }),
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        {formatX ? (
          <span className="ml-auto">
            {formatX(xExtent.min)} → {formatX(xExtent.max)}
          </span>
        ) : null}
      </div>
      {hover ? <p className="mt-2 text-sm text-ink">{hover}</p> : <p className="mt-2 text-sm text-muted">Hover a point for the reading.</p>}
    </div>
  );
}

export function BarList({
  bars,
  ariaLabel,
  formatValue,
}: {
  bars: Array<{ label: string; value: number; color?: string; title?: string }>;
  ariaLabel: string;
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  if (bars.length === 0) return <p className="text-sm text-muted">No bars to draw.</p>;
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-2">
      {bars.map((bar) => (
        <div key={bar.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm" title={bar.title}>
          <span className="text-muted">{bar.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full"
              style={{
              width: bar.value <= 0 ? "0%" : `${Math.max(2, (bar.value / max) * 100)}%`,
              background: bar.color ?? "var(--amber)",
            }}
            />
          </span>
          <span className="tabular text-ink">{formatValue(bar.value)}</span>
        </div>
      ))}
    </div>
  );
}
