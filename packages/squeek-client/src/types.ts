import type { UintString } from "./uint";

/**
 * Response types follow the public HTTP API documented at
 * https://docs.squeekchain.com/developers/api/ (the snapshot shipped with this repo).
 * The live service adds fields and, for some routes, newer schema versions.
 * Unknown fields are preserved by the client and ignored by these types.
 * Decimal strings stay strings. See {@link UintString}.
 */

export type Availability = "available" | "unavailable";

export interface ChainCursor {
  target?: string;
  chainId?: UintString;
  confirmations?: UintString;
  deploymentBlock?: UintString;
  economyDeploymentBlock?: UintString;
  indexedThroughBlock?: UintString;
  safeThroughBlock?: UintString;
  safeBlockHash?: string;
  safeBlockTimestamp?: string;
}

export interface NamedArgument {
  name: string;
  value: string;
}

export interface CoreIdentities {
  core: string;
  proxyAdmin?: string;
  proxyAdminOwner?: string;
  operatorTimelock?: string;
  operatorProposer?: string;
  proxyImplementation?: string;
  proxyAdminSlot?: string;
  /** Present on the live deployment; absent from the attached docs snapshot. */
  factory?: string;
}

export interface CoreConfiguration {
  streamId: string;
  genesisTimestamp: UintString;
  roundDuration: UintString;
  maxWorkPerRound: UintString;
  maxRoundsPerBatch: UintString;
  guardian: string;
  reporter: string;
  initialWorkPerThousandBlocks: UintString;
  targetBlocksPerActiveRound: UintString;
  difficultySmoothingRounds: UintString;
  blockUnitsPerBlock: UintString;
}

export interface CoreLedger {
  cumulativeWork: UintString;
  cumulativeBlockUnits: UintString;
  blockHeight: UintString;
  blockProgress: UintString;
  workPerThousandBlocks: UintString;
  settledThroughRound: UintString;
  authorizationNonce: UintString;
  paused: boolean;
}

export interface CoreEvent {
  id: string;
  contractKind: string;
  contractAddress: string;
  eventName: string;
  blockNumber: UintString;
  blockHash: string;
  /** Unix seconds, as a decimal string, on `/v1/core`. */
  blockTimestamp: UintString;
  transactionHash: string;
  transactionIndex: UintString;
  logIndex: UintString;
  arguments: NamedArgument[];
}

export interface CoreResponse {
  schemaVersion: number;
  installationId?: string;
  status: Availability;
  reason?: string;
  chain?: ChainCursor;
  identities?: CoreIdentities;
  configuration?: CoreConfiguration;
  core?: CoreLedger;
  implementation?: {
    codeAddress?: string;
    codeVersion?: UintString;
    storageLayoutDigest?: string;
    runtimeHash?: string;
  };
  governance?: {
    operationId?: string;
    operationKind?: string;
    operationState?: string;
  };
  source?: {
    eventName?: string;
    blockNumber?: UintString;
    blockHash?: string;
    blockTimestamp?: UintString;
    transactionHash?: string;
    transactionIndex?: UintString;
    logIndex?: UintString;
  };
  events?: CoreEvent[];
}

export type Freshness = "online" | "stale";
export type Provenance = "hardware" | "simulated" | "replay" | "derived" | string;
export type CoreDeviceStatus = "IDLE" | "ACTIVE" | "COUNTER_FAULT" | string;

export interface MeasurementReading {
  freshness: Freshness | string;
  observedAt: string;
  receivedAt: string;
  staleAfterSeconds: number;
  counterEpoch: string;
  cumulativeWorkUnits: UintString;
  provenance: Provenance;
  coreStatus: CoreDeviceStatus;
  /** Thousandths of a revolution per minute. JSON number, not a decimal string. */
  rpmMilli: number;
  speedMmPerSecond: number;
  /** Distance the device reports for its current noon-to-noon day, in millimetres. */
  distanceMm: number;
}

export interface ProjectedFrontier {
  cumulativeWork: UintString;
  cumulativeBlockUnits: UintString;
  blockHeight: UintString;
  blockProgress: UintString;
  workPerThousandBlocks: UintString;
  firstCompletedBlock: UintString | null;
  lastCompletedBlock: UintString | null;
  completedBlockCount: UintString;
  lifecycle: "optimistic" | string;
}

export interface StatusResponse {
  schemaVersion: number;
  installationId?: string;
  revision?: string;
  generatedAt: string;
  measurement: MeasurementReading | null;
  builder: {
    status: Availability | string;
    reason?: string;
    anchor?: {
      cumulativeWork: UintString;
      cumulativeBlockUnits: UintString;
      blockHeight: UintString;
      blockProgress: UintString;
      workPerThousandBlocks: UintString;
      settledThroughRound: UintString;
      confirmedAt?: string;
      transactionHash?: string;
    };
    queued?: {
      closedRoundCount: UintString;
      closedWorkUnits: UintString;
      openRoundWorkUnits: UintString;
    };
    projected?: ProjectedFrontier;
  };
  oracle: {
    state: string;
    reason: string | null;
    latestAcceptedAt?: string | null;
    latestClosure?: {
      firstRound: UintString;
      lastRound: UintString;
      roundCount: UintString;
      acceptedAt: string;
    } | null;
  };
  settlementQueue: {
    status: Availability | string;
    reason?: string;
    state?: string;
    settlementEnabled?: boolean;
    reporterEnvironmentEnabled?: boolean;
    buffered?: {
      firstRound: UintString | null;
      lastRound: UintString | null;
      roundCount: UintString;
      activeRoundCount: UintString;
      workUnits: UintString;
    };
    projected?: ProjectedFrontier;
    incidentOpen?: boolean;
    blockedReason?: string | null;
    lastRun?: {
      startedAt: string;
      finishedAt: string;
      result: string;
    } | null;
    latestSubmission?: {
      submissionId?: string;
      lifecycle?: string;
      previousSettledThroughRound?: UintString;
      settledThroughRound?: UintString;
      roundCount?: UintString;
      activeRoundCount?: UintString;
      expected?: ProjectedFrontier;
      transactionHash?: string | null;
      createdAt?: string | null;
      submittedAt?: string | null;
      confirmedAt?: string | null;
      terminalAt?: string | null;
      changedAt?: string | null;
      outcomeCode?: string | null;
    } | null;
  };
  signer?: {
    kind?: string;
    algorithm?: string;
    keySlot?: string;
    enrolledAt?: string;
    lastVerifiedAt?: string;
    lastSignature?: string;
  } | null;
  modules?: Array<{
    instanceId?: string;
    moduleType?: string;
    driverId?: string;
    moduleVersion?: string;
    schemaVersion?: number;
    state?: string;
    observedAt?: string;
    provenance?: string;
    health?: { checkedAt?: string; code?: string; message?: string };
    data?: unknown;
  }>;
}

export type StatsRange = "7d" | "30d";
export type BucketCoverage = "complete" | "partial" | "missing" | "future" | string;

export interface HalfHourBucket {
  startMinuteUtc: number;
  coverage: BucketCoverage;
  observedRoundCount: number;
  /** Null when the bucket was not observed. A missing bucket is not zero work. */
  workUnits: UintString | null;
}

export interface ActivityDay {
  date: string;
  coverage?: {
    expectedRoundCount?: number;
    observedRoundCount?: number;
    coverageBps?: number;
  };
  observedWorkUnits?: UintString;
  distanceMm?: UintString | null;
  buckets: HalfHourBucket[];
}

export interface RecordSample {
  value: UintString;
  occurredAt: string;
  coverage: string;
}

export interface MeasurementStatsResponse {
  schemaVersion: number;
  installationId?: string;
  revision?: string;
  generatedAt: string;
  range: StatsRange | string;
  timezone?: string;
  window?: {
    startAt: string;
    endAt: string;
    dayCount: number;
    bucketSeconds: number;
    roundSeconds: number;
  };
  lifetime?: {
    acceptedWorkUnits?: UintString;
    observedDistanceMm?: UintString;
    activeDayCount?: number;
    settledBlockCount?: UintString;
    settlementCount?: UintString;
    coverageBps?: number;
    firstObservedAt?: string | null;
    settledWorkUnits?: UintString;
  };
  activity?: {
    provenance?: string;
    coverage?: {
      expectedRoundCount?: number;
      observedRoundCount?: number;
      coverageBps?: number;
      complete?: boolean;
    };
    summary?: {
      observedWorkUnits?: UintString;
      observedDistanceMm?: UintString;
      activeDayCount?: number;
      inactiveDayCount?: number;
      averageWorkPerActiveDayMilli?: UintString | null;
      medianWorkPerActiveDay?: UintString | null;
      averageDistancePerActiveDayMm?: UintString | null;
      mostActiveDate?: string | null;
      mostActiveDateWorkUnits?: UintString | null;
      peakWindowStartMinuteUtc?: number | null;
    };
    days?: ActivityDay[];
    typicalDay?: Array<{
      startMinuteUtc: number;
      totalWorkUnits: UintString;
      observedDayCount: number;
      meanWorkMilli: UintString;
    }>;
  };
  records?: {
    mostWorkHalfHour?: RecordSample | null;
    mostWorkUtcDay?: RecordSample | null;
    maximumDailyDistanceMm?: RecordSample | null;
    peakObservedRpmMilli?: RecordSample | null;
    peakObservedSpeedMmPerSecond?: RecordSample | null;
    longestActiveWindowMinutes?: RecordSample | null;
    longestActiveDayStreak?: RecordSample | null;
  };
  blocks?: {
    status: Availability | string;
    reason?: string;
    completedBlockCount?: UintString;
    [key: string]: unknown;
  };
  rounds?: {
    observedCount?: number;
    activeCount?: number;
    zeroWorkCount?: number;
    missingCount?: number;
    activeRateBps?: number;
    averageActiveWorkMilli?: UintString | null;
    medianActiveWork?: UintString | null;
    p90ActiveWork?: UintString | null;
    mostActiveWork?: UintString | null;
  };
  oracle?: {
    status: Availability | string;
    reason?: string;
    [key: string]: unknown;
  };
}

export type SettlementRange = "now" | "24h" | "7d" | "30d";

export interface SettlementRecord {
  transactionHash: string;
  previousSettledThroughRound: UintString;
  settledThroughRound: UintString;
  activeRoundCount: UintString;
  workAdded: UintString;
  cumulativeWork: UintString;
  cumulativeBlockUnits: UintString;
  firstCompletedBlock?: UintString | null;
  lastCompletedBlock?: UintString | null;
  completedBlockCount: UintString;
  blockHeight: UintString;
  ethereumBlockNumber: UintString;
  /** ISO 8601 on `/v1/settlements`, unlike `/v1/core` event timestamps. */
  blockTimestamp: string;
  logIndex: UintString;
  confirmationStatus?: string;
  sqkMintedBaseUnits?: UintString;
}

export interface SettlementBucket {
  startAt: string;
  endAt: string;
  settlementCount: UintString;
  activeRoundCount: UintString;
  workAdded: UintString;
  completedBlockCount: UintString;
  sqkMintedBaseUnits?: UintString;
}

export interface CheckpointRecord {
  afterRound: UintString;
  throughRound: UintString;
  completedBlockCount: UintString;
  cumulativeWork?: UintString;
  cumulativeBlockUnits?: UintString;
  eligibleWeight?: UintString;
  amountBaseUnits: UintString;
  totalMintedBaseUnits?: UintString;
  /** Live schema name for the same idea as `totalMintedBaseUnits`. */
  miningMintedBaseUnits?: UintString;
  transactionHash?: string;
  ethereumBlockNumber?: UintString;
  blockTimestamp: string;
  logIndex?: UintString;
  confirmationStatus?: string;
}

export interface SettlementsResponse {
  schemaVersion: number;
  installationId?: string;
  status: Availability;
  reason?: string;
  range: SettlementRange | string;
  generatedAt?: string;
  chain?: ChainCursor;
  window?: { startAt: string; endAt: string; bucketSeconds: number } | null;
  summary?: {
    settlementCount: UintString;
    activeRoundCount: UintString;
    workAdded: UintString;
    completedBlockCount: UintString;
    archivedSettlementCount?: UintString;
  };
  recentSettlements?: SettlementRecord[];
  buckets?: SettlementBucket[];
  mining?: {
    status: Availability | string;
    reason?: string;
    economy?: {
      releaseId?: string;
      mining?: string;
      token?: string;
      symbol?: string;
      decimals?: number;
    };
    rewardPerBlock?: UintString;
    supplyCap?: UintString;
    premintBaseUnits?: UintString;
    totalMintedBaseUnits?: UintString;
    miningMintedBaseUnits?: UintString;
    unmintedCapacityBaseUnits?: UintString;
    processedThroughRound?: UintString;
    rangeMintedBaseUnits?: UintString;
    rangeCheckpointCount?: UintString;
    schedule?: Record<string, unknown>;
    nextRound?: {
      state?: string;
      round?: UintString;
      countedThroughRound?: UintString;
      startsAt?: string;
      endsAt?: string;
      previousCumulativeBlockUnits?: UintString;
      cumulativeBlockUnits?: UintString;
      completedBlockCount?: UintString;
      eligibleWeight?: UintString;
      amountBaseUnits?: UintString;
    };
    recentCheckpoints?: CheckpointRecord[];
  };
  recentRounds?: Array<{
    roundId: UintString;
    endAt: string;
    sqkMintedBaseUnits: UintString;
  }>;
  previousPeriod?: {
    startAt: string;
    endAt: string;
    sqkMintedBaseUnits: UintString;
  };
}

export type EventCategory = "all" | "protocol" | "players" | "measurement";

export interface ChainEventSource {
  kind: "chain";
  chainId?: UintString;
  target?: string;
  releaseId?: string;
  contractAddress?: string;
  blockNumber?: UintString;
  blockHash?: string;
  transactionHash?: string;
  transactionIndex?: UintString;
  logIndex?: UintString;
  confirmationStatus?: string;
}

export interface MeasurementEventSource {
  kind: "measurement";
  installationId?: string;
  receiptCursor?: UintString;
  telemetryId?: string;
  observedAt?: string;
  receivedAt?: string;
  policyVersion?: string;
  disposition?: string;
}

export interface FeedEvent {
  id: string;
  eventVersion?: number;
  occurredAt: string;
  recordedAt: string;
  source: ChainEventSource | MeasurementEventSource | { kind: string; [key: string]: unknown };
  type: string;
  payload: Record<string, unknown>;
}

export interface EventsResponse {
  schemaVersion: number;
  installationId?: string;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  catalogVersion?: string;
  chain?: ChainCursor;
  release?: { id?: string; protocolRevision?: string; rewardModelRevision?: string };
  identities?: Record<string, unknown>;
  nextCursor: string | null;
  category?: string;
  activeEventTypes?: string[];
  events?: FeedEvent[];
}

/** Documented route. The live service currently answers 404 for this path; callers must handle that. */
export interface MiningStateResponse {
  schemaVersion: number;
  installationId?: string;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  release?: { id?: string; protocolRevision?: string; rewardModelRevision?: string };
  chain?: ChainCursor;
  identities?: Record<string, unknown>;
  asset?: { address?: string; symbol?: string; decimals?: number };
  issuance?: {
    mintedBaseUnits?: UintString;
    tokenSupplyBaseUnits?: UintString;
    unmintedCapacityBaseUnits?: UintString;
    closedThroughBlock?: UintString;
    processedThroughRound?: UintString;
    lastActivationRound?: UintString;
    supplyCapBaseUnits?: UintString;
    paidBaseUnits?: UintString;
  };
  collection?: {
    phase?: string;
    paused?: boolean;
    publicMinted?: UintString;
    publicAllocation?: UintString;
    reserveMinted?: UintString;
    protocolReserve?: UintString;
    publicPriceBaseUnits?: UintString;
    allowlistStart?: string | null;
    allowlistEnd?: string | null;
  };
  livePositionCount?: UintString;
}

/**
 * Observed live route. It is not in the attached docs snapshot, which documents
 * `GET /v1/mining/state` instead. Fields match a schemaVersion 2 response seen
 * from the public API and may grow.
 */
export interface EconomyStateResponse {
  schemaVersion: number;
  installationId?: string;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  release?: { id?: string; protocolRevision?: string; rewardModelRevision?: string };
  chain?: ChainCursor;
  identities?: Record<string, unknown>;
  asset?: { address?: string; symbol?: string; decimals?: number };
  lifecycle?: {
    stage?: string;
    startRound?: UintString;
    currentRound?: UintString;
    paused?: boolean;
    guardian?: string;
  };
  supply?: {
    capBaseUnits?: UintString;
    premintBaseUnits?: UintString;
    miningMintedBaseUnits?: UintString;
    totalMintedBaseUnits?: UintString;
    totalBurnedBaseUnits?: UintString;
    liveSupplyBaseUnits?: UintString;
    unmintedCapacityBaseUnits?: UintString;
  };
  schedule?: Record<string, unknown>;
  mining?: Record<string, unknown>;
  staking?: unknown;
  nft?: Record<string, unknown>;
}

export interface OwnerPosition {
  tokenId: UintString;
  level: number;
  activeWeight: UintString;
  targetWeight?: UintString;
  pendingRound?: UintString | null;
  pendingActivationSource?: string | null;
  mergeState?: string;
  nextMergeBlock?: UintString;
  blocksUntilMerge?: UintString;
  claimableBaseUnits?: UintString;
  earnedBaseUnits?: UintString;
  earnedSevenDayBaseUnits?: UintString;
  ownershipStartedAt?: string;
  metadataStatus?: string;
}

export interface OwnerSqueeksResponse {
  schemaVersion: number;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  owner?: string;
  chain?: ChainCursor;
  release?: { id?: string; protocolRevision?: string; rewardModelRevision?: string };
  identities?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  mining?: Record<string, unknown>;
  summary?: {
    positionCount?: UintString;
    activeWeight?: UintString;
    targetWeight?: UintString;
    claimableBaseUnits?: UintString;
    earnedBaseUnits?: UintString;
    earnedSevenDayBaseUnits?: UintString;
  };
  earnings?: Array<{ date: string; earnedBaseUnits: UintString }>;
  positions?: OwnerPosition[];
  nextCursor: string | null;
}

export interface OwnerActivityEntry {
  id: string;
  kind: "mint" | "merge" | "claim" | "transfer" | string;
  tokenIds?: UintString[];
  amountBaseUnits?: UintString | null;
  from?: string | null;
  to?: string | null;
  level?: number | null;
  effectiveRound?: UintString | null;
  nextMergeBlock?: UintString | null;
  source?: Record<string, unknown>;
}

export interface OwnerActivityResponse {
  schemaVersion: number;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  owner?: string;
  chain?: ChainCursor;
  release?: Record<string, unknown>;
  identities?: Record<string, unknown>;
  activity?: OwnerActivityEntry[];
  total?: UintString;
  nextCursor: string | null;
}

export interface SqueekMetadataResponse {
  schemaVersion: number;
  status: Availability;
  reason?: string;
  generatedAt?: string;
  tokenId?: UintString;
  chain?: ChainCursor;
  identities?: Record<string, unknown>;
  release?: Record<string, unknown>;
  collection?: string;
  name?: string;
  description?: string;
  imageDataUri?: string;
  cardImageUrl?: string;
  attributes?: Array<{ traitType: string; value: string }>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
