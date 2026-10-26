import {
  impliedCircumferenceMm,
  speedHundredthsOfKmh,
  tryUint,
  workSeries,
  type WorkPoint,
} from "@squeek-analytics/client";
import { BarList } from "../components/Charts.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { ErrorBlock, Kpi, LoadingBlock, Note, Panel } from "../components/States.tsx";
import { useSqueek } from "../data.tsx";
import { ageLabel, chartNumber, formatBps, formatHundredths, formatMilli, formatUint, formatWhen } from "../lib/format.ts";

function recordValue(sample: { value: string; occurredAt: string; coverage: string } | null | undefined, format: (value: bigint) => string): string {
  if (!sample) return "No record yet";
  const parsed = tryUint(sample.value);
  if (parsed == null) return "No record yet";
  return `${format(parsed)} · ${formatWhen(sample.occurredAt)} · ${sample.coverage}`;
}

export function Hamster() {
  const { status, stats, events, refresh } = useSqueek();
  if (status.loading && !status.data) return <LoadingBlock label="the latest reading" />;
  if (!status.data && status.error) return <ErrorBlock error={status.error} onRetry={refresh} />;
  const reading = status.data?.measurement ?? null;
  const records = stats.data?.records;
  const points = stats.data ? workSeries(stats.data) : [];
  const typical = stats.data?.activity?.typicalDay ?? [];
  const observedTypical = typical.filter((slot) => slot.observedDayCount > 0);

  const rpm = reading ? reading.rpmMilli : null;
  const speed = reading ? reading.speedMmPerSecond : null;
  const circumference = rpm != null && speed != null ? impliedCircumferenceMm(rpm, speed) : null;
  const kmh = speed == null ? null : speedHundredthsOfKmh(speed);
  const needleMax = 120;
  const needleRpm = rpm == null ? 0 : Math.min(needleMax, Number(rpm) / 1000);
  const angle = -210 + (needleRpm / needleMax) * 240;

  const milestones = (events.data?.events ?? []).filter((event) => event.type.startsWith("measurement."));

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Hamster</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">What the wheel reading supports</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          RPM, speed, and distance are estimates from accepted magnet passages. They do not prove who turned the wheel, which way it turned, or how many calories that took. The API publishes the latest reading, not a speed history, so this page does not draw a made-up RPM timeline.
        </p>
      </div>

      {reading == null ? (
        <Note tone="amber">No measurement has been accepted yet. There is no RPM, speed, or distance to show.</Note>
      ) : (
        <>
          {reading.freshness !== "online" ? (
            <Note tone="amber">
              This reading is {reading.freshness}. It was received {ageLabel(reading.receivedAt)}, and the API marks a reading stale after {reading.staleAfterSeconds}s. The figures below are that last reading. They are not zeros, and they are not a new sample.
            </Note>
          ) : (
            <Note>Reading is online. Received {ageLabel(reading.receivedAt)}.</Note>
          )}

          <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
            <Panel className="flex flex-col items-center">
              <Gauge angle={angle} stale={reading.freshness !== "online"} label={`${formatMilli(reading.rpmMilli)} rpm`} />
              <p className="mt-2 text-center text-xs text-muted">Scale stops at {needleMax} rpm. The number is the reading, even past the scale.</p>
            </Panel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Kpi label="Speed" value={kmh == null ? "—" : `${formatHundredths(kmh)} km/h`} detail={`${reading.speedMmPerSecond} mm/s`} />
              <Kpi label="Day distance" value={`${formatUint(BigInt(reading.distanceMm))} mm`} detail="Device day, noon to noon. Not animal travel." />
              <Kpi label="Counter" value={formatUint(tryUint(reading.cumulativeWorkUnits))} detail={`Epoch ${reading.counterEpoch.slice(0, 8)}… · ${reading.coreStatus}`} />
              <Kpi
                label="Implied circumference"
                value={circumference == null ? "—" : `${formatUint(circumference)} mm`}
                detail="Integer mm from this paired rpm and speed. Not a second sensor."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={reading.provenance === "hardware" ? "sage" : "coral"}>{reading.provenance}</Badge>
            <Badge tone={reading.coreStatus === "COUNTER_FAULT" ? "coral" : "sky"}>{reading.coreStatus}</Badge>
            <Badge tone={reading.freshness === "online" ? "sage" : "amber"}>{reading.freshness}</Badge>
            {(status.data?.modules ?? []).map((module) => (
              <Badge key={module.instanceId ?? module.moduleType} tone={module.state === "ready" ? "sage" : "amber"}>
                {module.instanceId ?? "module"} {module.state ?? ""}
              </Badge>
            ))}
          </div>
        </>
      )}

      <Panel title="Records in the statistics window" eyebrow={stats.data ? `${stats.data.range} · partial coverage still counts as partial` : "statistics"}>
        {stats.loading && !stats.data ? <LoadingBlock label="records" /> : null}
        {stats.error && !stats.data ? <ErrorBlock error={stats.error} onRetry={refresh} /> : null}
        {stats.data ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Record label="Peak RPM" value={recordValue(records?.peakObservedRpmMilli, (value) => `${formatMilli(Number(value))} rpm`)} />
            <Record label="Peak speed" value={recordValue(records?.peakObservedSpeedMmPerSecond, (value) => `${formatHundredths(speedHundredthsOfKmh(Number(value)) ?? 0n)} km/h`)} />
            <Record label="Most work in a half hour" value={recordValue(records?.mostWorkHalfHour, (value) => `${formatUint(value)} work`)} />
            <Record label="Most work in a noon-day" value={recordValue(records?.mostWorkUtcDay, (value) => `${formatUint(value)} work`)} />
            <Record label="Longest reported day distance" value={recordValue(records?.maximumDailyDistanceMm, (value) => `${formatUint(value)} mm`)} />
            <Record label="Longest active window" value={recordValue(records?.longestActiveWindowMinutes, (value) => `${formatUint(value)} min`)} />
            <Record label="Longest active-day streak" value={recordValue(records?.longestActiveDayStreak, (value) => `${formatUint(value)} ${value === 1n ? "day" : "days"}`)} />
          </dl>
        ) : null}
        <p className="mt-3 text-sm text-muted">
          A null record stays “No record yet”. Rounds observed {stats.data?.rounds?.observedCount ?? "—"}, active {stats.data?.rounds?.activeCount ?? "—"}, zero-work {stats.data?.rounds?.zeroWorkCount ?? "—"}, missing {stats.data?.rounds?.missingCount ?? "—"}. Active rate {formatBps(stats.data?.rounds?.activeRateBps)}.
        </p>
      </Panel>

      <Panel title="Activity pattern" eyebrow="Mean work by half hour, only slots with an observed day">
        {observedTypical.length === 0 ? (
          <Note>No half-hour slot in this window has an observed day yet, so there is no typical-day pattern to draw.</Note>
        ) : (
          <BarList
            ariaLabel="Typical day mean work"
            formatValue={(value) => formatMilli(value, 3)}
            bars={observedTypical.map((slot) => {
              const mean = tryUint(slot.meanWorkMilli);
              return {
                label: minuteLabel(slot.startMinuteUtc),
                value: mean == null || chartNumber(mean) == null ? 0 : Number(mean),
                title: `${slot.observedDayCount} observed day(s), total ${slot.totalWorkUnits} work`,
                color: "var(--sage)",
              };
            })}
          />
        )}
        <p className="mt-3 text-sm text-muted">
          meanWorkMilli is thousandths of a work unit. A slot that was never observed is left off this chart rather than shown as a zero average. The heatmap below keeps missing time visible.
        </p>
        <Heatmap points={points.filter((point) => point.day === points.at(-1)?.day || point.startMs > Date.now() - 36 * 60 * 60 * 1000)} />
      </Panel>

      <Panel title="Measurement milestones" eyebrow="Event feed, category measurement">
        {events.loading && !events.data ? <LoadingBlock label="measurement events" /> : null}
        {events.error && !events.data ? <ErrorBlock error={events.error} onRetry={refresh} /> : null}
        {events.data?.status === "unavailable" ? <Note tone="amber">Event feed unavailable ({events.data.reason ?? "no reason"}).</Note> : null}
        {milestones.length === 0 && events.data ? <Note>No measurement events on the first page of the feed.</Note> : null}
        <ul className="grid gap-2">
          {milestones.map((event) => (
            <li key={event.id} className="rounded-2xl border border-line bg-sunken/50 px-3 py-2 text-sm">
              <span className="text-ink">{event.type.replace("measurement.", "").replaceAll("_", " ")}</span>
              <span className="mt-1 block text-muted">{formatWhen(event.occurredAt)} · {describePayload(event.payload)}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Note>
        Uptime here is freshness plus round coverage, not a sensor heartbeat log. Coverage in the stats window is {formatBps(stats.data?.activity?.coverage?.coverageBps)}. Signer last verified {formatWhen(status.data?.signer?.lastVerifiedAt)}. The public API does not return a passage-level RPM series, so peaks are records, not a curve.
      </Note>
    </div>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-sunken/50 px-3 py-3">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function Gauge({ angle, stale, label }: { angle: number; stale: boolean; label: string }) {
  const radians = (angle * Math.PI) / 180;
  const x2 = 100 + Math.cos(radians) * 62;
  const y2 = 110 + Math.sin(radians) * 62;
  return (
    <svg viewBox="0 0 200 160" className="w-full max-w-[16rem]" role="img" aria-label={`Wheel speed ${label}`}>
      <path d="M28 110 A72 72 0 1 1 172 110" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
      <path d="M28 110 A72 72 0 1 1 172 110" fill="none" stroke={stale ? "var(--muted)" : "var(--amber)"} strokeWidth="12" strokeLinecap="round" strokeDasharray="188" strokeDashoffset="70" />
      <line x1="100" y1="110" x2={x2} y2={y2} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="110" r="5" fill="var(--amber)" />
      <text x="100" y="146" textAnchor="middle" fill="var(--ink)" fontSize="16" fontFamily="Literata, serif">
        {label}
      </text>
    </svg>
  );
}

function minuteLabel(startMinuteUtc: number): string {
  const hour = Math.floor(startMinuteUtc / 60);
  const minute = startMinuteUtc % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function Heatmap({ points }: { points: WorkPoint[] }) {
  if (points.length === 0) return null;
  const days = new Map<string, WorkPoint[]>();
  for (const point of points) {
    const list = days.get(point.day) ?? [];
    list.push(point);
    days.set(point.day, list);
  }
  return (
    <div className="mt-4 grid gap-2">
      {[...days.entries()].slice(-2).map(([day, buckets]) => (
        <div key={day} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
          <span className="text-xs text-muted">{day}</span>
          <div className="grid grid-cols-[repeat(48,minmax(0,1fr))] gap-px">
            {buckets
              .slice()
              .sort((a, b) => a.startMs - b.startMs)
              .map((point) => (
                <span
                  key={`${day}-${point.startMs}`}
                  title={`${formatWhen(point.startMs / 1000)} · ${point.coverage}`}
                  className={`h-3 rounded-[2px] border border-line ${point.coverage === "missing" ? "stripe" : point.coverage === "future" ? "bg-transparent" : point.workUnits != null && point.workUnits > 0n ? "bg-amber" : "bg-sage/40"}`}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function describePayload(payload: Record<string, unknown>): string {
  const parts = Object.entries(payload).map(([key, value]) => `${key} ${typeof value === "string" || typeof value === "number" ? value : "…"}`);
  return parts.join(" · ");
}
