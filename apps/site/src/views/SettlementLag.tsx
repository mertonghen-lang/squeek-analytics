import {
  batchesFromCoreEvents,
  checkFrontier,
  quantile,
  roundEndUnix,
  settlementLags,
  timeToUnixSeconds,
  toUint,
  tryUint,
  type LagSample,
  type NormalizedBatch,
} from "@squeek-analytics/client";
import { BarList, LineChart } from "../components/Charts.tsx";
import { ErrorBlock, Kpi, LoadingBlock, Note, Panel, Unavailable } from "../components/States.tsx";
import { useSqueek } from "../data.tsx";
import { chartNumber, formatSeconds, formatUint, formatWhen } from "../lib/format.ts";

function histogram(values: bigint[]): Array<{ label: string; value: number; title: string }> {
  if (values.length === 0) return [];
  const numbers = values.flatMap((value) => {
    const asNumber = chartNumber(value);
    return asNumber == null ? [] : [asNumber];
  });
  if (numbers.length === 0) return [];
  const max = Math.max(...numbers);
  const width = max <= 120 ? 15 : max <= 900 ? 60 : 300;
  const bins = new Map<number, number>();
  for (const value of numbers) {
    const start = Math.floor(value / width) * width;
    bins.set(start, (bins.get(start) ?? 0) + 1);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, count]) => ({
      label: `${start}s`,
      value: count,
      title: `${count} batches with frontier lag from ${start}s to ${start + width - 1}s`,
    }));
}

export function SettlementLag() {
  const { core, status, settlements, chain, refresh } = useSqueek();
  if (core.loading && !core.data) return <LoadingBlock label="settlement history" />;
  if (!core.data && core.error) return <ErrorBlock error={core.error} onRetry={refresh} />;
  const body = core.data;
  if (!body) return <LoadingBlock label="settlement history" />;
  if (body.status !== "available" || !body.configuration) return <Unavailable reason={body.reason} />;

  const fromApi = batchesFromCoreEvents(body.events ?? []);
  const sourceBatches: NormalizedBatch[] = chain.phase === "ready" && chain.batches.length > fromApi.length ? chain.batches : fromApi;
  const usingChain = chain.phase === "ready" && sourceBatches === chain.batches;
  const lags = settlementLags(sourceBatches, toUint(body.configuration.genesisTimestamp), toUint(body.configuration.roundDuration));
  const frontier = checkFrontier(sourceBatches);
  const frontierLags = lags.map((lag) => lag.frontierLagSeconds);
  const positive = lags.filter((lag) => (lag.activeRoundCount ?? 0n) > 0n);
  const zeroWork = lags.length - positive.length;

  const checkpointByRound = new Map<string, { at: bigint; blocks: bigint }>();
  for (const checkpoint of settlements.data?.mining?.recentCheckpoints ?? []) {
    try {
      checkpointByRound.set(checkpoint.throughRound, {
        at: timeToUnixSeconds(checkpoint.blockTimestamp),
        blocks: toUint(checkpoint.completedBlockCount),
      });
    } catch {
      // Skip a checkpoint whose timestamp is not a unix second or ISO time.
    }
  }
  const checkpointLags = lags.flatMap((lag) => {
    const checkpoint = checkpointByRound.get(lag.settledThroughRound.toString());
    if (!checkpoint) return [];
    return [checkpoint.at - lag.blockTimestamp];
  });

  const latest = status.data?.settlementQueue.latestSubmission;
  const latestLag = latest?.settledThroughRound
    ? lags.find((lag) => lag.settledThroughRound.toString() === latest.settledThroughRound)
    : lags.at(-1);
  const buffered = status.data?.settlementQueue.status === "available" ? status.data.settlementQueue.buffered : undefined;
  const firstBuffered = tryUint(buffered?.firstRound);
  const lastBuffered = tryUint(buffered?.lastRound);
  const bufferedWork = tryUint(buffered?.workUnits);
  const bufferedActive = tryUint(buffered?.activeRoundCount);
  const snapshotAt = status.data?.generatedAt ? timeToUnixSeconds(status.data.generatedAt) : null;
  const oldestUnsettledEnd =
    firstBuffered == null ? null : roundEndUnix(toUint(body.configuration.genesisTimestamp), firstBuffered, toUint(body.configuration.roundDuration));
  const unsettledWait = oldestUnsettledEnd != null && snapshotAt != null ? snapshotAt - oldestUnsettledEnd : null;

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Settlement lag</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">How long a closed round waits for Ethereum</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Frontier lag is the Ethereum block time minus the end of the newest round in the batch. Round {`r`} ends at genesis + {`r`} × 600 seconds. The reporter checks about every five minutes; that is a schedule, not a deadline. Public views then wait for 12 confirmations, which is a second delay after the block itself.
        </p>
      </div>

      {bufferedWork != null && bufferedWork > 0n ? (
        <Panel title="Closed work still waiting" eyebrow="Queue on /v1/status, not yet a BatchSettled event">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Queued work" value={formatUint(bufferedWork)} detail={`${formatUint(bufferedActive)} active of ${formatUint(tryUint(buffered?.roundCount))} closed rounds`} />
            <Kpi label="Rounds" value={firstBuffered != null && lastBuffered != null ? `${formatUint(firstBuffered)}–${formatUint(lastBuffered)}` : "—"} detail="Inclusive, after the certified frontier" />
            <Kpi
              label="Oldest round has waited"
              value={formatSeconds(unsettledWait)}
              detail={oldestUnsettledEnd == null ? undefined : `Since ${formatWhen(oldestUnsettledEnd)}, measured at the status snapshot`}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            This wait is still open. It ends when a settlement block includes the round, which has not happened. The charts below are only batches that already landed, and they can be empty certifications while this queue holds the wheel&apos;s work.
          </p>
        </Panel>
      ) : null}

      {zeroWork === lags.length && lags.length > 0 ? (
        <Note tone="amber">
          Every landed batch in this history certified zero work. The lag charts are certification delay, including empty spans. They are not the wait for the queued wheel work above.
        </Note>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Batches" value={String(lags.length)} detail={usingChain ? "From Sepolia logs" : "From /v1/core events"} />
        <Kpi label="Median frontier lag" value={formatSeconds(quantile(frontierLags, 0.5))} />
        <Kpi label="p90 frontier lag" value={formatSeconds(quantile(frontierLags, 0.9))} />
        <Kpi label="Longest frontier lag" value={formatSeconds(quantile(frontierLags, 1))} detail={`${positive.length} batches had active rounds`} />
      </div>

      <Panel title="Frontier lag over time" eyebrow="Seconds from round end to the settlement block">
        {lags.length === 0 ? (
          <Note>No BatchSettled events were available, so there is no lag to plot.</Note>
        ) : (
          <LineChart
            ariaLabel="Settlement frontier lag by batch"
            formatY={(value) => `${Math.round(value)}s`}
            formatX={(value) => formatWhen(value).slice(11, 16)}
            series={[
              {
                id: "lag",
                label: "Frontier lag",
                color: "var(--coral)",
                points: lags.flatMap((lag) => {
                  const x = chartNumber(lag.blockTimestamp);
                  const y = chartNumber(lag.frontierLagSeconds);
                  if (x == null || y == null) return [];
                  return [{ x, y, title: `Round ${lag.settledThroughRound}: frontier lag ${formatSeconds(lag.frontierLagSeconds)}, span ${lag.spanRounds} rounds, oldest-round lag ${formatSeconds(lag.oldestRoundLagSeconds)}` }];
                }),
              },
            ]}
          />
        )}
      </Panel>

      <Panel title="Distribution" eyebrow="Nearest-rank, not a smoothed density">
        <BarList ariaLabel="Histogram of frontier lag" bars={histogram(frontierLags)} formatValue={(value) => `${value}`} />
        <p className="mt-3 text-sm text-muted">
          Median checkpoint lag, where a checkpoint in the settlement history matches the batch&apos;s frontier: {formatSeconds(quantile(checkpointLags, 0.5))}. Checkpoints fund SQK later; a BatchSettled event does not itself mint tokens. {checkpointLags.length} of {lags.length} batches have a matching checkpoint in the newest checkpoint list (the API returns a short list, not the full checkpoint history).
        </p>
      </Panel>

      <Panel title="Latest submission" eyebrow="/v1/status settlement queue">
        {status.data?.settlementQueue.status === "unavailable" ? <Unavailable reason={status.data.settlementQueue.reason} /> : null}
        {latest ? <Submission latestLag={latestLag} /> : <Note>No latest submission was on the status payload.</Note>}
      </Panel>

      <Panel title="Each batch" eyebrow={frontier.completeFromZero ? "Connects back to round 0" : "May be a partial window"}>
        <LagTable lags={lags} checkpoints={checkpointByRound} />
        <div className="mt-3 text-sm text-muted">
          {chain.phase === "skipped" ? <p>{chain.reason}</p> : null}
          {chain.phase === "loading" ? <p>Reading BatchSettled logs from the core address in this response, because the event list does not reach round 0.</p> : null}
          {chain.phase === "error" ? (
            <p>Sepolia log backfill failed ({chain.message}). The table is limited to the core events the API returned. An internal gap in that list is {frontier.internalGap ? "present" : "not present"}.</p>
          ) : null}
          {chain.phase === "ready" ? <p>Log scan returned {chain.batches.length} batches. {usingChain ? "That scan is what this table uses." : "The API list was already as long, so the table stays on the API."}</p> : null}
          {frontier.internalGap && chain.phase !== "error" ? <p>The batches in this table do not form one continuous frontier. A settlement is missing between two of them.</p> : null}
        </div>
      </Panel>

      <Note>
        Measurement statistics report oracle timings as {status.data ? "a separate object" : "not loaded"}. On the current stats payload that object is often unavailable (`projection_not_initialized`). This view does not fill that gap with estimated minutes. Negative lag would be shown if a block timestamp preceded the round end; nothing is clamped to zero.
      </Note>
    </div>
  );
}

function Submission({ latestLag }: { latestLag: LagSample | undefined }) {
  const { status } = useSqueek();
  const latest = status.data?.settlementQueue.latestSubmission;
  if (!latest) return null;
  const rows = [
    ["Round ended", latestLag ? formatWhen(latestLag.frontierRoundEndedAt) : "—"],
    ["Created", formatWhen(latest.createdAt)],
    ["Submitted", formatWhen(latest.submittedAt)],
    ["Settlement block", latestLag ? formatWhen(latestLag.blockTimestamp) : "—"],
    ["Marked confirmed", formatWhen(latest.confirmedAt)],
  ];
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Lifecycle {latest.lifecycle ?? "unknown"}
        {latest.outcomeCode ? ` · ${latest.outcomeCode}` : ""}. Queue state {status.data?.settlementQueue.state ?? "unknown"}.
        {latest.transactionHash ? ` Transaction ${latest.transactionHash}.` : ""}
      </p>
      <ol className="grid gap-2 sm:grid-cols-5">
        {rows.map(([label, value], index) => (
          <li key={label} className="rounded-2xl border border-line bg-sunken/60 px-3 py-2">
            <p className="text-xs text-muted">{index + 1}. {label}</p>
            <p className="mt-1 text-sm text-ink">{value}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LagTable({
  lags,
  checkpoints,
}: {
  lags: LagSample[];
  checkpoints: Map<string, { at: bigint; blocks: bigint }>;
}) {
  if (lags.length === 0) return <Note>Nothing to list.</Note>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="py-2 pr-3 font-medium">Frontier</th>
            <th className="py-2 pr-3 font-medium">Span</th>
            <th className="py-2 pr-3 font-medium">Active</th>
            <th className="py-2 pr-3 font-medium">Frontier lag</th>
            <th className="py-2 pr-3 font-medium">Oldest-round lag</th>
            <th className="py-2 pr-3 font-medium">Checkpoint lag</th>
            <th className="py-2 font-medium">Block time</th>
          </tr>
        </thead>
        <tbody>
          {[...lags].reverse().map((lag) => {
            const checkpoint = checkpoints.get(lag.settledThroughRound.toString());
            const checkpointLag = checkpoint ? checkpoint.at - lag.blockTimestamp : null;
            return (
              <tr key={`${lag.transactionHash ?? "tx"}-${lag.settledThroughRound}`} className="border-t border-line">
                <td className="tabular py-2 pr-3">{formatUint(lag.settledThroughRound)}</td>
                <td className="tabular py-2 pr-3">{formatUint(lag.spanRounds)}</td>
                <td className="tabular py-2 pr-3">{formatUint(lag.activeRoundCount)}</td>
                <td className="tabular py-2 pr-3">{formatSeconds(lag.frontierLagSeconds)}</td>
                <td className="tabular py-2 pr-3">{formatSeconds(lag.oldestRoundLagSeconds)}</td>
                <td className="tabular py-2 pr-3">{checkpointLag == null ? "—" : formatSeconds(checkpointLag)}</td>
                <td className="py-2">{formatWhen(lag.blockTimestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
