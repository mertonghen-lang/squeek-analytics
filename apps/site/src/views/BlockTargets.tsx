import {
  batchesFromCoreEvents,
  blockSplit,
  settlementLags,
  toUint,
  tryUint,
} from "@squeek-analytics/client";
import { LineChart } from "../components/Charts.tsx";
import { ErrorBlock, Kpi, LoadingBlock, Note, Panel, Unavailable } from "../components/States.tsx";
import { useSqueek } from "../data.tsx";
import { chartNumber, formatUint, formatWhen } from "../lib/format.ts";

export function BlockTargets() {
  const { core, status, settlements, refresh } = useSqueek();
  if (core.loading && !core.data) return <LoadingBlock label="SqueekCore" />;
  if (!core.data && core.error) return <ErrorBlock error={core.error} onRetry={refresh} />;
  const body = core.data;
  if (!body) return <LoadingBlock label="SqueekCore" />;
  if (body.status !== "available" || !body.core || !body.configuration) {
    return <Unavailable reason={body.reason} />;
  }

  const ledger = body.core;
  const height = tryUint(ledger.blockHeight);
  const progress = tryUint(ledger.blockProgress);
  const units = tryUint(ledger.cumulativeBlockUnits);
  const difficulty = tryUint(ledger.workPerThousandBlocks);
  const frontier = tryUint(ledger.settledThroughRound);
  const target = tryUint(body.configuration.targetBlocksPerActiveRound);
  const perBlock = tryUint(body.configuration.blockUnitsPerBlock) ?? 1_000_000_000n;
  const split = units == null ? null : blockSplit(units);
  const batches = batchesFromCoreEvents(body.events ?? []);
  const genesis = toUint(body.configuration.genesisTimestamp);
  const duration = toUint(body.configuration.roundDuration);
  const lags = settlementLags(batches, genesis, duration);
  const activeRounds = batches.reduce((sum, batch) => sum + (batch.activeRoundCount ?? 0n), 0n);
  const projectedHeight = tryUint(status.data?.builder.projected?.blockHeight);
  const projectedProgress = tryUint(status.data?.builder.projected?.blockProgress);

  const frontierPoints = lags.flatMap((lag) => {
    const y = chartNumber(lag.settledThroughRound);
    const x = chartNumber(lag.blockTimestamp);
    if (y == null || x == null) return [];
    return [{ x, y, title: `${formatWhen(lag.blockTimestamp)} · frontier ${lag.settledThroughRound} · span ${lag.spanRounds}` }];
  });
  const heightPoints = lags.flatMap((lag) => {
    const unitsAt = lag.cumulativeBlockUnits;
    const y = unitsAt == null ? 0 : chartNumber(unitsAt / perBlock);
    const x = chartNumber(lag.blockTimestamp);
    if (y == null || x == null) return [];
    return [{ x, y, title: `${formatWhen(lag.blockTimestamp)} · completed blocks ${unitsAt == null ? "unknown" : unitsAt / perBlock}` }];
  });

  const progressRatio = progress == null ? 0 : Number(progress) / Number(perBlock);

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Block milestones</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">Frontier first, blocks when work earns them</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          A measurement round is ten minutes. A Squeek block is one billion earned block units. They are not the same clock. The steering target of {formatUint(target)} blocks is the price an active round of at least 40 work moves difficulty toward. It is not a promise that every round completes that many blocks, and a zero-work round is not a miss against it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Settled height" value={formatUint(height)} detail={split ? `${formatUint(split.progress)} / ${formatUint(perBlock)} into the next` : undefined} />
        <Kpi label="Certified frontier" value={formatUint(frontier)} detail="settledThroughRound" />
        <Kpi label="Difficulty" value={formatUint(difficulty)} detail="Work per 1,000 blocks, for the next active round" />
        <Kpi label="Optimistic height" value={formatUint(projectedHeight)} detail="Not settled. From builder.projected" />
      </div>

      <Panel title="Progress toward the next settled block" eyebrow="Block units">
        <div className="h-3 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-sage" style={{ width: `${Math.max(0, Math.min(100, progressRatio * 100))}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          Settled progress is {formatUint(progress)} of {formatUint(perBlock)}.
          {projectedProgress != null ? ` The optimistic reading, if queued work settles as projected, would sit at height ${formatUint(projectedHeight)} with ${formatUint(projectedProgress)} units beyond that.` : ""}
        </p>
      </Panel>

      <Panel title="Certified rounds" eyebrow="Each BatchSettled event">
        {frontierPoints.length === 0 ? (
          <Note>No BatchSettled events were in this core response, so there is no frontier timeline yet.</Note>
        ) : (
          <LineChart
            ariaLabel="Certified frontier over settlement time"
            formatY={(value) => String(Math.round(value))}
            formatX={(value) => formatWhen(value).slice(11, 16)}
            series={[{ id: "frontier", label: "Settled-through round", color: "var(--amber)", points: frontierPoints }]}
          />
        )}
      </Panel>

      <Panel title="Completed Squeek blocks" eyebrow="Derived from block units, not from physical work">
        {heightPoints.length === 0 ? (
          <Note>No settlement in this response carried cumulative block units.</Note>
        ) : (
          <LineChart
            ariaLabel="Completed Squeek block height over settlement time"
            formatY={(value) => String(Math.round(value))}
            formatX={(value) => formatWhen(value).slice(11, 16)}
            series={[{ id: "height", label: "Completed blocks", color: "var(--sage)", points: heightPoints }]}
          />
        )}
        <p className="mt-2 text-sm text-muted">
          Active rounds inside these batches: {formatUint(activeRounds)}. Height and difficulty move when an active round settles. A zero-work batch certifies the frontier and leaves both where they were. The statistics endpoint does not publish per-block completion times{status.data ? "" : " yet"}.
        </p>
      </Panel>

      <Panel title="Settlements in the last day" eyebrow="/v1/settlements?range=24h">
        {settlements.loading && !settlements.data ? <LoadingBlock label="settlements" /> : null}
        {settlements.error && !settlements.data ? <ErrorBlock error={settlements.error} onRetry={refresh} /> : null}
        {settlements.data?.status === "unavailable" ? <Unavailable reason={settlements.data.reason} /> : null}
        {settlements.data?.status === "available" ? (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <Kpi label="Settlements" value={formatUint(tryUint(settlements.data.summary?.settlementCount))} detail="Includes batches that completed no blocks" />
              <Kpi label="Blocks completed" value={formatUint(tryUint(settlements.data.summary?.completedBlockCount))} />
              <Kpi label="Work added" value={formatUint(tryUint(settlements.data.summary?.workAdded))} />
            </div>
            {(settlements.data.recentSettlements ?? []).length === 0 ? (
              <Note>recentSettlements only lists batches that completed Squeek blocks. This window has none. Zero-block batches are still counted in the summary and drawn from core events above.</Note>
            ) : (
              <SettlementRows rows={settlements.data.recentSettlements ?? []} />
            )}
          </>
        ) : null}
      </Panel>

      <Note>
        Count blocks from block units. Do not divide physical work by today&apos;s difficulty. Rounds after the frontier are unknown, not zero. One settlement can complete several blocks, and there is no per-block event.
        {body.core.paused ? " Settlement is paused." : " Settlement is not paused."} Safe through Ethereum block {body.chain?.safeThroughBlock ?? "—"} ({body.chain?.confirmations ?? "12"} confirmations).
      </Note>
    </div>
  );
}

function SettlementRows({ rows }: { rows: Array<{ settledThroughRound: string; completedBlockCount: string; workAdded: string; blockTimestamp: string }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="py-2 pr-3 font-medium">Round</th>
            <th className="py-2 pr-3 font-medium">Work</th>
            <th className="py-2 pr-3 font-medium">Blocks</th>
            <th className="py-2 font-medium">Ethereum time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.blockTimestamp}-${row.settledThroughRound}`} className="border-t border-line">
              <td className="tabular py-2 pr-3">{row.settledThroughRound}</td>
              <td className="tabular py-2 pr-3">{row.workAdded}</td>
              <td className="tabular py-2 pr-3">{row.completedBlockCount}</td>
              <td className="py-2">{formatWhen(row.blockTimestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
