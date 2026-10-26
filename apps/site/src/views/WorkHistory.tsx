import {
  blockSplit,
  priceThenSteer,
  tryUint,
  workSeries,
  type WorkPoint,
} from "@squeek-analytics/client";
import { BarList, LineChart } from "../components/Charts.tsx";
import { ErrorBlock, Kpi, LoadingBlock, Note, Panel, Unavailable } from "../components/States.tsx";
import { useSqueek } from "../data.tsx";
import { chartNumber, formatUint, formatWhen } from "../lib/format.ts";
import { Button } from "../components/ui/button.tsx";

function cellClass(point: WorkPoint): string {
  if (point.coverage === "future") return "bg-transparent border-line";
  if (point.coverage === "missing" || point.workUnits == null) return "stripe border-line";
  if (point.workUnits > 0n) return "border-amber/50 bg-amber";
  if (point.coverage === "partial") return "border-amber/40 bg-amber/30";
  return "border-sage/40 bg-sage/35";
}

export function WorkHistory() {
  const { stats, status, core, range, setRange, refresh } = useSqueek();
  if (stats.loading && !stats.data) return <LoadingBlock label="measurement statistics" />;
  if (!stats.data && stats.error) return <ErrorBlock error={stats.error} onRetry={refresh} />;
  const body = stats.data;
  if (!body) return <LoadingBlock label="measurement statistics" />;

  const points = workSeries(body);
  const observed = points.filter((point) => point.workUnits != null);
  const accepted = tryUint(body.lifetime?.acceptedWorkUnits ?? body.activity?.summary?.observedWorkUnits);
  const settled = tryUint(body.lifetime?.settledWorkUnits) ?? tryUint(core.data?.core?.cumulativeWork);
  const reading = status.data?.measurement;
  const openRound = tryUint(status.data?.builder.queued?.openRoundWorkUnits);
  const counter = reading ? tryUint(reading.cumulativeWorkUnits) : null;
  const projectedWork = tryUint(status.data?.builder.projected?.cumulativeWork);
  const firstObserved = body.lifetime?.firstObservedAt ? Date.parse(body.lifetime.firstObservedAt) : null;
  const since = firstObserved == null ? observed : observed.filter((point) => point.startMs >= firstObserved - 30 * 60_000);
  const cumulativeSeries = since.flatMap((point) => {
    const y = point.cumulativeWorkUnits == null ? null : chartNumber(point.cumulativeWorkUnits);
    if (point.cumulativeWorkUnits != null && y == null) return [];
    return [{ x: point.startMs, y, title: `${formatWhen(point.startMs / 1000)} · ${point.coverage} · ${point.workUnits == null ? "unknown" : `${point.workUnits} work`}` }];
  });

  const days = new Map<string, WorkPoint[]>();
  for (const point of points) {
    const list = days.get(point.day) ?? [];
    list.push(point);
    days.set(point.day, list);
  }

  const queuedClosed = tryUint(status.data?.builder.queued?.closedWorkUnits);
  const queuedRounds = tryUint(status.data?.builder.queued?.closedRoundCount);
  const anchorDifficulty = tryUint(status.data?.builder.anchor?.workPerThousandBlocks ?? core.data?.core?.workPerThousandBlocks);
  const projection = openRound != null && anchorDifficulty != null ? priceThenSteer(openRound, anchorDifficulty, tryUint(status.data?.builder.anchor?.cumulativeBlockUnits) ?? 0n) : null;
  const apiProjectedBlocks = tryUint(status.data?.builder.projected?.blockHeight);
  const split = projection ? blockSplit(projection.cumulativeBlockUnits) : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Work history</p>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">Accepted wheel work, not a live guess</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Closed rounds are the only work the statistics endpoint will chart. The open round&apos;s counter is shown beside that history, and settled work is whatever SqueekCore has already recorded. A missing bucket stays blank. It is not drawn as zero.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={range === "7d" ? "default" : "outline"} onClick={() => setRange("7d")}>7 days</Button>
          <Button size="sm" variant={range === "30d" ? "default" : "outline"} onClick={() => setRange("30d")}>30 days</Button>
        </div>
      </div>

      {stats.error ? <ErrorBlock error={stats.error} onRetry={refresh} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Accepted closed rounds" value={formatUint(accepted)} detail="lifetime.acceptedWorkUnits" />
        <Kpi label="Settled on Ethereum" value={formatUint(settled)} detail="Confirmed work in SqueekCore" />
        <Kpi label="Open-round counter" value={formatUint(openRound)} detail="Not an accepted round yet" />
        <Kpi label="Optimistic total" value={formatUint(projectedWork)} detail="builder.projected, not settled" />
      </div>

      <Panel title="Where the units sit" eyebrow="Same moment, three stages">
        <BarList
          ariaLabel="Work units by stage"
          formatValue={(value) => formatUint(BigInt(Math.round(value)))}
          bars={[
            { label: "Accepted", value: accepted == null ? 0 : Number(accepted), color: "var(--sage)", title: "Closed rounds the API has accepted" },
            { label: "Open round", value: openRound == null ? 0 : Number(openRound), color: "var(--amber)", title: "Counter in the round that has not closed" },
            { label: "Settled", value: settled == null ? 0 : Number(settled), color: "var(--sky)", title: "Work recorded by SqueekCore" },
          ]}
        />
        <p className="mt-3 text-sm text-muted">
          The counter epoch currently reports {formatUint(counter)} work units
          {reading ? `, observed ${formatWhen(reading.observedAt)} (${reading.freshness})` : ""}.
          {queuedClosed != null
            ? ` ${formatUint(queuedClosed)} of the accepted work sits in ${formatUint(queuedRounds)} closed ${queuedRounds === 1n ? "round" : "rounds"} that ${queuedRounds === 1n ? "is" : "are"} queued and not yet in SqueekCore.`
            : ""}
          {" "}Distance for the device&apos;s current day is a separate series and is not converted into work here.
        </p>
      </Panel>

      <Panel title="Cumulative accepted work" eyebrow={body.range}>
        <LineChart
          ariaLabel="Cumulative accepted work over observed half hours"
          formatY={(value) => formatUint(BigInt(Math.round(value)))}
          formatX={(value) => formatWhen(value / 1000).slice(5, 16)}
          series={[{ id: "accepted", label: "Cumulative accepted work", color: "var(--sage)", points: cumulativeSeries }]}
        />
        <p className="mt-2 text-sm text-muted">
          The line breaks on missing and future buckets. Zero means an observed round with no accepted passages, which includes rounds closed while the Pi was stopped. It does not mean the wheel was watched and idle.
        </p>
      </Panel>

      <Panel title="Coverage by half hour" eyebrow="Noon-to-noon days, UTC">
        <div className="grid gap-2">
          {[...days.entries()].map(([day, buckets]) => (
            <div key={day} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
              <span className="text-xs text-muted">{day}</span>
              <div className="grid grid-cols-[repeat(48,minmax(0,1fr))] gap-px">
                {buckets
                  .slice()
                  .sort((a, b) => a.startMs - b.startMs)
                  .map((point) => (
                    <span
                      key={`${day}-${point.startMinuteUtc}`}
                      className={`h-4 rounded-[2px] border ${cellClass(point)}`}
                      title={`${formatWhen(point.startMs / 1000)} · ${point.coverage} · ${point.workUnits == null ? "no work total" : `${point.workUnits} work`}`}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-sage/40 bg-sage/35" /> observed zero</span>
          <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-amber/40 bg-amber/30" /> partial</span>
          <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-amber bg-amber" /> work</span>
          <span className="inline-flex items-center gap-1"><i className="stripe inline-block h-3 w-3 rounded-sm border border-line" /> missing</span>
          <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-line" /> future</span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Window {body.window ? `${formatWhen(body.window.startAt)} to ${formatWhen(body.window.endAt)}` : "—"}. Coverage {body.activity?.coverage?.observedRoundCount ?? "—"} of {body.activity?.coverage?.expectedRoundCount ?? "—"} expected rounds
          {body.lifetime?.firstObservedAt ? `. First accepted round ${formatWhen(body.lifetime.firstObservedAt)}` : ""}. Buckets before that are missing because this deployment had not started, not because a record was lost.
        </p>
      </Panel>

      <Panel title="If the open round settled as read" eyebrow="Integer check, labeled optimistic">
        {status.data?.builder.status === "unavailable" ? <Unavailable reason={status.data.builder.reason} /> : null}
        {projection && split ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Block units" value={formatUint(projection.blockUnitsAdded)} detail="floor(work × 10^12 / difficulty)" />
            <Kpi label="Height this would reach" value={formatUint(split.height)} detail={`${formatUint(split.progress)} units into the next block`} />
            <Kpi label="Difficulty after" value={formatUint(projection.difficultyAfter)} detail={projection.work >= 40n ? "Steers, because work is at least 40" : "Unchanged, because work is under 40"} />
            <p className="text-sm text-muted sm:col-span-3">
              This prices only the still-open round. builder.projected height is {formatUint(apiProjectedBlocks)}, and that figure also folds in closed rounds waiting in the queue, steering once per active round. The two heights answer different questions. The optimistic total above is the API figure. Neither number is settled, and neither has issued SQK.
            </p>
          </div>
        ) : (
          <Note>The status payload did not include both an open-round work total and a difficulty, so there is no projection to check.</Note>
        )}
      </Panel>

      <Note>
        Statistics are shared for about a minute. Block completion times are {body.blocks?.status === "unavailable" ? `unavailable (${body.blocks.reason ?? "no reason"})` : "included on the block milestone view"}. Oracle settlement timings are {body.oracle?.status === "unavailable" ? `unavailable (${body.oracle.reason ?? "no reason"})` : "available in the statistics payload"}; the settlement view derives lag from core events instead of inventing those timings.
        {body.generatedAt ? ` Snapshot ${formatWhen(body.generatedAt)}.` : ""}
      </Note>
    </div>
  );
}
