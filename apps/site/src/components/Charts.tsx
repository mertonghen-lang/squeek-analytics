import { useId, useState, type PointerEvent } from "react";

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

interface Tip {
  key: string;
  title: string;
  color: string;
  left: number;
  top: number;
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

function linePath(points: ChartPoint[], xOf: (value: number) => number, yOf: (value: number) => number): string {
  let penDown = false;
  let path = "";
  for (const point of points) {
    if (point.y == null) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${xOf(point.x).toFixed(2)} ${yOf(point.y).toFixed(2)} `;
    penDown = true;
  }
  return path;
}

function areaPath(points: ChartPoint[], xOf: (value: number) => number, yOf: (value: number) => number, baseline: number): string {
  let path = "";
  let segment: ChartPoint[] = [];
  const flush = () => {
    const drawn = segment.filter((point) => point.y != null);
    if (drawn.length === 0) return;
    const first = drawn[0];
    const last = drawn[drawn.length - 1];
    if (!first || !last || first.y == null || last.y == null) return;
    path += `M${xOf(first.x).toFixed(2)} ${yOf(baseline).toFixed(2)} `;
    for (const point of drawn) {
      if (point.y == null) continue;
      path += `L${xOf(point.x).toFixed(2)} ${yOf(point.y).toFixed(2)} `;
    }
    path += `L${xOf(last.x).toFixed(2)} ${yOf(baseline).toFixed(2)} Z `;
    segment = [];
  };
  for (const point of points) {
    if (point.y == null) flush();
    else segment.push(point);
  }
  flush();
  return path;
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
  const rawId = useId().replace(/:/g, "");
  const [tip, setTip] = useState<Tip | null>(null);
  const width = 720;
  const height = 280;
  const pad = { l: 64, r: 16, t: 18, b: 32 };
  const xs = series.flatMap((item) => item.points.map((point) => point.x));
  const ys = series.flatMap((item) => item.points.flatMap((point) => (point.y == null ? [] : [point.y])));
  if (xs.length === 0 || ys.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-sunken/50 px-4 py-10 text-center">
        <p className="text-sm text-ink">Nothing to plot in this range.</p>
        <p className="mt-1 text-sm text-muted">Missing buckets stay blank. They are not drawn as zero.</p>
      </div>
    );
  }
  const xExtent = extent(xs);
  const yExtent = extent(ys);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xOf = (value: number) => pad.l + ((value - xExtent.min) / (xExtent.max - xExtent.min)) * plotW;
  const yOf = (value: number) => pad.t + (1 - (value - yExtent.min) / (yExtent.max - yExtent.min)) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yExtent.min + (yExtent.max - yExtent.min) * t);
  const xTicks = [0, 0.5, 1].map((t) => xExtent.min + (xExtent.max - xExtent.min) * t);

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const svgY = ((event.clientY - rect.top) / rect.height) * height;
    let best: Tip | null = null;
    let bestDistance = 28;
    for (const item of series) {
      for (const point of item.points) {
        if (point.y == null) continue;
        const dx = xOf(point.x) - svgX;
        const dy = yOf(point.y) - svgY;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = {
            key: `${item.id}-${point.x}`,
            title: point.title,
            color: item.color,
            left: (xOf(point.x) / width) * 100,
            top: (yOf(point.y) / height) * 100,
          };
        }
      }
    }
    setTip(best);
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="h-auto w-full touch-pan-y"
          onPointerMove={move}
          onPointerLeave={() => setTip(null)}
        >
          <defs>
            {series.map((item) => (
              <linearGradient key={item.id} id={`${rawId}-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.38" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--line)" />
              <text x={pad.l - 10} y={yOf(tick) + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
                {formatY(tick)}
              </text>
            </g>
          ))}
          {formatX
            ? xTicks.map((tick) => (
                <text key={tick} x={xOf(tick)} y={height - 8} textAnchor="middle" fill="var(--muted)" fontSize="11">
                  {formatX(tick)}
                </text>
              ))
            : null}
          {series.map((item) =>
            item.dashed ? null : (
              <path key={`${item.id}-area`} d={areaPath(item.points, xOf, yOf, yExtent.min)} fill={`url(#${rawId}-${item.id})`} />
            ),
          )}
          {series.map((item) => (
            <path
              key={item.id}
              d={linePath(item.points, xOf, yOf)}
              fill="none"
              stroke={item.color}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={item.dashed ? "5 4" : undefined}
            />
          ))}
          {series.flatMap((item) =>
            item.points.flatMap((point) => {
              if (point.y == null) return [];
              const key = `${item.id}-${point.x}`;
              const active = tip?.key === key;
              return [
                <circle key={key} cx={xOf(point.x)} cy={yOf(point.y)} r={active ? 5.5 : 3.2} fill={item.color} stroke="var(--paper)" strokeWidth={active ? 2 : 0}>
                  <title>{point.title}</title>
                </circle>,
              ];
            }),
          )}
        </svg>
        {tip ? (
          <div
            className="pointer-events-none absolute z-10 max-w-[16rem] rounded-xl border border-line bg-sunken/95 px-3 py-2 text-xs leading-5 text-ink shadow-lg"
            style={{
              left: `${tip.left}%`,
              top: `${tip.top}%`,
              transform: tip.left > 68 ? "translate(-110%, -120%)" : "translate(12px, -120%)",
            }}
          >
            <span className="mb-1 inline-block h-1.5 w-4 rounded-full" style={{ background: tip.color }} />
            <p>{tip.title}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <p className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
        {tip ? tip.title : "Hover a point for the reading."}
      </p>
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
  if (bars.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-sunken/50 px-4 py-8 text-center">
        <p className="text-sm text-ink">No bars to draw.</p>
        <p className="mt-1 text-sm text-muted">This range did not include values for the chart.</p>
      </div>
    );
  }
  return (
    <div role="img" aria-label={ariaLabel} className="grid gap-2.5">
      {bars.map((bar) => (
        <div key={bar.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_auto]" title={bar.title}>
          <span className="truncate text-muted">{bar.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full"
              style={{
                width: bar.value <= 0 ? "0%" : `${Math.max(2, (bar.value / max) * 100)}%`,
                background: `linear-gradient(90deg, ${bar.color ?? "var(--amber)"}, color-mix(in srgb, ${bar.color ?? "var(--amber)"} 55%, white))`,
              }}
            />
          </span>
          <span className="tabular text-ink">{formatValue(bar.value)}</span>
        </div>
      ))}
    </div>
  );
}
