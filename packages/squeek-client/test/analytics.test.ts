import { describe, expect, it } from "vitest";
import {
  batchesFromCoreEvents,
  blockSplit,
  bucketStartMs,
  checkFrontier,
  impliedCircumferenceMm,
  priceThenSteer,
  quantile,
  roundEndUnix,
  settlementLags,
  speedHundredthsOfKmh,
  timeToUnixSeconds,
  workSeries,
  type CoreEvent,
  type MeasurementStatsResponse,
} from "../src/index.ts";

describe("price then steer", () => {
  it("matches the docs example of 80 work at difficulty 10,000", () => {
    const step = priceThenSteer(80n, 10_000n, 1_700_000_000n);
    expect(step.blockUnitsAdded).toBe(8_000_000_000n);
    expect(step.cumulativeBlockUnits).toBe(9_700_000_000n);
    expect(step.completedBlocksAdded).toBe(8n);
    expect(step.difficultyAfter).toBe(9_733n);
    expect(blockSplit(step.cumulativeBlockUnits)).toEqual({ height: 9n, progress: 700_000_000n });
  });

  it("leaves difficulty unchanged below 40 work", () => {
    const step = priceThenSteer(39n, 10_000n, 0n);
    expect(step.difficultyAfter).toBe(10_000n);
    expect(step.blockUnitsAdded).toBe(3_900_000_000n);
  });

  it("matches the live open-round projection of 149 work at difficulty 10,000", () => {
    const step = priceThenSteer(149n, 10_000n, 0n);
    expect(step.cumulativeBlockUnits).toBe(14_900_000_000n);
    expect(blockSplit(step.cumulativeBlockUnits)).toEqual({ height: 14n, progress: 900_000_000n });
    expect(step.difficultyAfter).toBe(9_790n);
  });
});

describe("work series", () => {
  it("orders noon-wrapped buckets and does not treat missing work as zero", () => {
    const stats = {
      activity: {
        days: [
          {
            date: "2026-10-26",
            buckets: [
              { startMinuteUtc: 0, coverage: "future", observedRoundCount: 0, workUnits: null },
              { startMinuteUtc: 720, coverage: "missing", observedRoundCount: 0, workUnits: null },
              { startMinuteUtc: 810, coverage: "partial", observedRoundCount: 1, workUnits: "0" },
              { startMinuteUtc: 840, coverage: "complete", observedRoundCount: 3, workUnits: "4" },
            ],
          },
        ],
      },
    } as MeasurementStatsResponse;

    const points = workSeries(stats);
    expect(points.map((point) => point.startMinuteUtc)).toEqual([720, 810, 840, 0]);
    expect(bucketStartMs("2026-10-26", 720)).toBe(Date.parse("2026-10-26T12:00:00.000Z"));
    expect(bucketStartMs("2026-10-26", 0)).toBe(Date.parse("2026-10-27T00:00:00.000Z"));
    expect(points[0]?.workUnits).toBeNull();
    expect(points[0]?.cumulativeWorkUnits).toBeNull();
    expect(points[1]?.cumulativeWorkUnits).toBe(0n);
    expect(points[2]?.cumulativeWorkUnits).toBe(4n);
    expect(points[3]?.workUnits).toBeNull();
  });
});

describe("settlement lag", () => {
  const genesis = 1_793_022_600n;
  const duration = 600n;

  function batch(partial: Partial<CoreEvent> & Pick<CoreEvent, "arguments" | "blockTimestamp">): CoreEvent {
    return {
      id: "1",
      contractKind: "core",
      contractAddress: "0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44",
      eventName: "BatchSettled",
      blockNumber: "12000588",
      blockHash: "0xabc",
      transactionHash: "0xdef",
      transactionIndex: "60",
      logIndex: "133",
      ...partial,
    };
  }

  it("computes frontier lag and the catch-up lag of a span that starts at round 0", () => {
    const events = [
      batch({
        blockTimestamp: "1793049036",
        logIndex: "133",
        arguments: [
          { name: "settledThroughRound", value: "44" },
          { name: "previousSettledThroughRound", value: "43" },
          { name: "activeRoundCount", value: "0" },
          { name: "cumulativeWork", value: "0" },
          { name: "cumulativeBlockUnits", value: "0" },
        ],
      }),
      batch({
        blockTimestamp: "1793037336",
        logIndex: "10",
        blockNumber: "11999620",
        arguments: [
          { name: "settledThroughRound", value: "24" },
          { name: "previousSettledThroughRound", value: "0" },
          { name: "activeRoundCount", value: "0" },
          { name: "cumulativeWork", value: "0" },
          { name: "cumulativeBlockUnits", value: "0" },
        ],
      }),
    ];
    const batches = batchesFromCoreEvents(events);
    expect(batches.map((item) => item.settledThroughRound)).toEqual([24n, 44n]);
    const lags = settlementLags(batches, genesis, duration);
    expect(lags[0]?.frontierLagSeconds).toBe(336n);
    expect(lags[0]?.oldestRoundLagSeconds).toBe(14_136n);
    expect(lags[0]?.spanRounds).toBe(24n);
    expect(lags[1]?.frontierLagSeconds).toBe(36n);
    expect(lags[1]?.oldestRoundLagSeconds).toBe(36n);
    expect(checkFrontier(batches)).toEqual({ completeFromZero: false, internalGap: true, batchCount: 2 });
  });

  it("treats a connected chain from round 0 as complete", () => {
    const events = [1, 2].map((round) =>
      batch({
        blockTimestamp: String(1_000 + round),
        logIndex: String(round),
        arguments: [
          { name: "settledThroughRound", value: String(round) },
          { name: "previousSettledThroughRound", value: String(round - 1) },
          { name: "activeRoundCount", value: "0" },
        ],
      }),
    );
    const check = checkFrontier(batchesFromCoreEvents(events));
    expect(check.completeFromZero).toBe(true);
    expect(check.internalGap).toBe(false);
  });

  it("ends round r at genesis plus r durations", () => {
    expect(roundEndUnix(genesis, 45n, duration)).toBe(genesis + 45n * duration);
    expect(roundEndUnix(genesis, 0n, duration)).toBe(genesis);
  });

  it("ranks quantiles and parses ISO checkpoint times", () => {
    expect(quantile([36n, 36n, 336n], 0.5)).toBe(36n);
    expect(quantile([36n, 36n, 336n], 1)).toBe(336n);
    expect(quantile([], 0.5)).toBeNull();
    expect(timeToUnixSeconds("2026-10-26T21:10:36.000Z")).toBe(1_793_049_036n);
  });
});

describe("hamster rates", () => {
  it("derives circumference and speed from a paired reading", () => {
    expect(impliedCircumferenceMm(83149, 1217)).toBe(878n);
    expect(impliedCircumferenceMm(0, 1217)).toBeNull();
    expect(speedHundredthsOfKmh(1217)).toBe(438n);
    expect(speedHundredthsOfKmh(1526)).toBe(549n);
  });
});
