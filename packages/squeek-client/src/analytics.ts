import { SqueekNumericError } from "./errors";
import type { CoreEvent, MeasurementStatsResponse } from "./types";
import { toUint, tryUint } from "./uint";

/** One Squeek block is one billion block units. */
export const BLOCK_UNITS_PER_BLOCK = 1_000_000_000n;

/** Work units at which an active round steers difficulty. Below this it still earns block units. */
export const DIFFICULTY_STEER_WORK = 40n;

const NOON_MINUTE = 12 * 60;

export interface PriceSteerStep {
  work: bigint;
  difficultyBefore: bigint;
  blockUnitsAdded: bigint;
  cumulativeBlockUnits: bigint;
  difficultyAfter: bigint;
  completedBlocksAdded: bigint;
}

/**
 * SqueekCore's price-then-steer step, in integer arithmetic.
 * `U_next = U + floor(w * 10^12 / D)`.
 * Difficulty moves only when `w >= 40`:
 * `floor((29 * D + floor(w * 1000 / 40)) / 30)`.
 */
export function priceThenSteer(
  work: bigint,
  difficulty: bigint,
  cumulativeBlockUnits = 0n,
): PriceSteerStep {
  if (work < 0n || cumulativeBlockUnits < 0n || difficulty <= 0n) {
    throw new SqueekNumericError(
      "priceThenSteer requires nonnegative work and block units, and difficulty above zero",
    );
  }
  const blockUnitsAdded = (work * 1_000_000_000_000n) / difficulty;
  const nextUnits = cumulativeBlockUnits + blockUnitsAdded;
  const completedBlocksAdded =
    nextUnits / BLOCK_UNITS_PER_BLOCK - cumulativeBlockUnits / BLOCK_UNITS_PER_BLOCK;
  const difficultyAfter =
    work >= DIFFICULTY_STEER_WORK
      ? (29n * difficulty + (work * 1000n) / DIFFICULTY_STEER_WORK) / 30n
      : difficulty;
  return {
    work,
    difficultyBefore: difficulty,
    blockUnitsAdded,
    cumulativeBlockUnits: nextUnits,
    difficultyAfter,
    completedBlocksAdded,
  };
}

export function blockSplit(cumulativeBlockUnits: bigint): { height: bigint; progress: bigint } {
  if (cumulativeBlockUnits < 0n) {
    throw new SqueekNumericError("block units cannot be negative");
  }
  return {
    height: cumulativeBlockUnits / BLOCK_UNITS_PER_BLOCK,
    progress: cumulativeBlockUnits % BLOCK_UNITS_PER_BLOCK,
  };
}

/**
 * Start of a measurement-stats half-hour bucket.
 * Days run from 12:00 UTC to 12:00 UTC and are named by the date of their starting noon.
 * `startMinuteUtc` is minutes from 00:00 UTC, so minutes before noon belong to the next calendar date.
 */
export function bucketStartMs(day: string, startMinuteUtc: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match || !Number.isInteger(startMinuteUtc) || startMinuteUtc < 0 || startMinuteUtc >= 1440) {
    throw new SqueekNumericError(`Bad bucket time ${day} @ ${startMinuteUtc}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const dayOffset = startMinuteUtc < NOON_MINUTE ? 86_400_000 : 0;
  return utcMidnight + dayOffset + startMinuteUtc * 60_000;
}

export interface WorkPoint {
  startMs: number;
  day: string;
  startMinuteUtc: number;
  coverage: string;
  /** Null unless the bucket was observed. Missing and future buckets are never coerced to zero. */
  workUnits: bigint | null;
  /** Running sum of observed work. Null on gaps so a chart can break the line. */
  cumulativeWorkUnits: bigint | null;
}

export function workSeries(stats: Pick<MeasurementStatsResponse, "activity">): WorkPoint[] {
  const points: WorkPoint[] = [];
  for (const day of stats.activity?.days ?? []) {
    for (const bucket of day.buckets ?? []) {
      const observed = bucket.coverage === "complete" || bucket.coverage === "partial";
      const workUnits = observed ? tryUint(bucket.workUnits) : null;
      points.push({
        startMs: bucketStartMs(day.date, bucket.startMinuteUtc),
        day: day.date,
        startMinuteUtc: bucket.startMinuteUtc,
        coverage: bucket.coverage,
        workUnits,
        cumulativeWorkUnits: null,
      });
    }
  }
  points.sort((a, b) => a.startMs - b.startMs);
  let cumulative = 0n;
  for (const point of points) {
    if (point.workUnits == null) continue;
    cumulative += point.workUnits;
    point.cumulativeWorkUnits = cumulative;
  }
  return points;
}

export interface NormalizedBatch {
  settledThroughRound: bigint;
  previousSettledThroughRound: bigint;
  activeRoundCount: bigint | null;
  cumulativeWork: bigint | null;
  cumulativeBlockUnits: bigint | null;
  blockTimestamp: bigint;
  transactionHash: string | null;
  ethereumBlockNumber: bigint | null;
  logIndex: bigint | null;
}

function argumentMap(event: CoreEvent): Map<string, string> {
  return new Map(event.arguments.map((argument) => [argument.name, argument.value]));
}

/** `BatchSettled` rows from `/v1/core` events, oldest first. Events missing frontier fields are skipped. */
export function batchesFromCoreEvents(events: readonly CoreEvent[]): NormalizedBatch[] {
  const batches: NormalizedBatch[] = [];
  for (const event of events) {
    if (event.eventName !== "BatchSettled") continue;
    const args = argumentMap(event);
    const through = args.get("settledThroughRound");
    const previous = args.get("previousSettledThroughRound");
    if (through == null || previous == null) continue;
    batches.push({
      settledThroughRound: toUint(through),
      previousSettledThroughRound: toUint(previous),
      activeRoundCount: tryUint(args.get("activeRoundCount")),
      cumulativeWork: tryUint(args.get("cumulativeWork")),
      cumulativeBlockUnits: tryUint(args.get("cumulativeBlockUnits")),
      blockTimestamp: toUint(event.blockTimestamp),
      transactionHash: event.transactionHash,
      ethereumBlockNumber: tryUint(event.blockNumber),
      logIndex: tryUint(event.logIndex),
    });
  }
  batches.sort((a, b) => {
    if (a.blockTimestamp !== b.blockTimestamp) return a.blockTimestamp < b.blockTimestamp ? -1 : 1;
    const left = a.logIndex ?? 0n;
    const right = b.logIndex ?? 0n;
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
  return batches;
}

export interface LagSample {
  settledThroughRound: bigint;
  previousSettledThroughRound: bigint;
  spanRounds: bigint;
  frontierLagSeconds: bigint;
  oldestRoundLagSeconds: bigint;
  blockTimestamp: bigint;
  frontierRoundEndedAt: bigint;
  oldestRoundEndedAt: bigint;
  activeRoundCount: bigint | null;
  cumulativeWork: bigint | null;
  cumulativeBlockUnits: bigint | null;
  transactionHash: string | null;
}

/**
 * Delay from a round's end to the Ethereum block that certified it.
 * Round `r` ends at `genesis + r * duration` (the instant the next round starts).
 * Frontier lag is the wait for the newest round in the batch.
 * Oldest-round lag is the wait for the first round the batch newly certifies, which is
 * long when one batch catches up a span of earlier rounds.
 */
/** Instant round `roundId` ends: genesis + roundId × duration. Round 0 ends one duration after genesis. */
export function roundEndUnix(genesisTimestamp: bigint, roundId: bigint, roundDuration: bigint): bigint {
  if (roundDuration <= 0n) throw new SqueekNumericError("round duration must be positive");
  if (genesisTimestamp < 0n || roundId < 0n) {
    throw new SqueekNumericError("round end requires a nonnegative genesis and round id");
  }
  return genesisTimestamp + roundId * roundDuration;
}

export function settlementLags(
  batches: readonly NormalizedBatch[],
  genesisTimestamp: bigint,
  roundDuration: bigint,
): LagSample[] {
  if (roundDuration <= 0n) throw new SqueekNumericError("round duration must be positive");
  return batches.map((batch) => {
    const frontierRoundEndedAt = roundEndUnix(genesisTimestamp, batch.settledThroughRound, roundDuration);
    const oldestRoundEndedAt = roundEndUnix(
      genesisTimestamp,
      batch.previousSettledThroughRound + 1n,
      roundDuration,
    );
    return {
      settledThroughRound: batch.settledThroughRound,
      previousSettledThroughRound: batch.previousSettledThroughRound,
      spanRounds: batch.settledThroughRound - batch.previousSettledThroughRound,
      frontierLagSeconds: batch.blockTimestamp - frontierRoundEndedAt,
      oldestRoundLagSeconds: batch.blockTimestamp - oldestRoundEndedAt,
      blockTimestamp: batch.blockTimestamp,
      frontierRoundEndedAt,
      oldestRoundEndedAt,
      activeRoundCount: batch.activeRoundCount,
      cumulativeWork: batch.cumulativeWork,
      cumulativeBlockUnits: batch.cumulativeBlockUnits,
      transactionHash: batch.transactionHash,
    };
  });
}

export interface FrontierCheck {
  /** Oldest batch starts at round 0 and every later batch continues that frontier. */
  completeFromZero: boolean;
  /** Some batch in this list does not continue the previous batch's frontier. */
  internalGap: boolean;
  batchCount: number;
}

export function checkFrontier(batches: readonly NormalizedBatch[]): FrontierCheck {
  if (batches.length === 0) return { completeFromZero: false, internalGap: false, batchCount: 0 };
  const sorted = [...batches].sort((a, b) =>
    a.settledThroughRound < b.settledThroughRound ? -1 : a.settledThroughRound > b.settledThroughRound ? 1 : 0,
  );
  let internalGap = false;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current) continue;
    if (current.previousSettledThroughRound !== previous.settledThroughRound) internalGap = true;
  }
  const oldest = sorted[0];
  return {
    completeFromZero: oldest != null && oldest.previousSettledThroughRound === 0n && !internalGap,
    internalGap,
    batchCount: sorted.length,
  };
}

/** Nearest-rank quantile. `p` is between 0 and 1. */
export function quantile(values: readonly bigint[], p: number): bigint | null {
  if (values.length === 0) return null;
  if (!(p >= 0 && p <= 1)) throw new SqueekNumericError("quantile p must be between 0 and 1");
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? null;
}

export function timeToUnixSeconds(value: string): bigint {
  if (/^(0|[1-9]\d*)$/.test(value)) return toUint(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new SqueekNumericError(`Not a timestamp: ${JSON.stringify(value)}`);
  return BigInt(Math.floor(ms / 1000));
}

/**
 * Whole millimetres of wheel circumference implied by one paired reading.
 * `speed = (rpm / 60) * circumference`, so `circumference = speedMmPerSecond * 60000 / rpmMilli`.
 * Returns null when rpm is zero. Integer division drops a fraction of a millimetre.
 */
export function impliedCircumferenceMm(rpmMilli: number, speedMmPerSecond: number): bigint | null {
  if (!Number.isInteger(rpmMilli) || !Number.isInteger(speedMmPerSecond)) return null;
  if (rpmMilli <= 0 || speedMmPerSecond < 0) return null;
  return (BigInt(speedMmPerSecond) * 60_000n) / BigInt(rpmMilli);
}

/** Hundredths of a kilometre per hour, from millimetres per second. `1217` → `438` (4.38 km/h). */
export function speedHundredthsOfKmh(speedMmPerSecond: number): bigint | null {
  if (!Number.isInteger(speedMmPerSecond) || speedMmPerSecond < 0) return null;
  return (BigInt(speedMmPerSecond) * 36n) / 100n;
}
