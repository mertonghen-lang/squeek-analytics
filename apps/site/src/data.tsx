import {
  SqueekClient,
  batchesFromCoreEvents,
  checkFrontier,
  type CoreResponse,
  type EventsResponse,
  type MeasurementStatsResponse,
  type NormalizedBatch,
  type SettlementsResponse,
  type StatsRange,
  type StatusResponse,
} from "@squeek-analytics/client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const apiBase =
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "/squeek-api" : "https://api.squeekchain.com");

export interface Slot<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  updatedAt: number | null;
}

export type ChainState =
  | { phase: "idle" }
  | { phase: "skipped"; reason: string }
  | { phase: "loading" }
  | { phase: "ready"; batches: NormalizedBatch[] }
  | { phase: "error"; message: string };

interface SqueekContextValue {
  status: Slot<StatusResponse>;
  core: Slot<CoreResponse>;
  settlements: Slot<SettlementsResponse>;
  stats: Slot<MeasurementStatsResponse>;
  events: Slot<EventsResponse>;
  range: StatsRange;
  setRange: (range: StatsRange) => void;
  refresh: () => void;
  chain: ChainState;
  apiBase: string;
}

const empty = <T,>(): Slot<T> => ({ data: null, error: null, loading: true, updatedAt: null });

const SqueekContext = createContext<SqueekContextValue | null>(null);

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function SqueekProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new SqueekClient({ baseUrl: apiBase }), []);
  const [tick, setTick] = useState(0);
  const [range, setRange] = useState<StatsRange>("7d");
  const [status, setStatus] = useState(empty<StatusResponse>());
  const [core, setCore] = useState(empty<CoreResponse>());
  const [settlements, setSettlements] = useState(empty<SettlementsResponse>());
  const [stats, setStats] = useState(empty<MeasurementStatsResponse>());
  const [events, setEvents] = useState(empty<EventsResponse>());
  const [chain, setChain] = useState<ChainState>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [statusResult, coreResult, settlementResult, statsResult, eventsResult] = await Promise.allSettled([
        client.getStatus(),
        client.getCore(),
        client.getSettlements("24h"),
        client.getMeasurementStats(range),
        client.getEvents({ category: "measurement", limit: 40 }),
      ]);
      if (cancelled) return;
      const stamp = Date.now();
      const apply = <T,>(result: PromiseSettledResult<T>, previous: Slot<T>): Slot<T> => {
        if (result.status === "fulfilled") {
          return { data: result.value, error: null, loading: false, updatedAt: stamp };
        }
        const error = asError(result.reason);
        if (previous.data) return { ...previous, error, loading: false };
        return { data: null, error, loading: false, updatedAt: null };
      };
      setStatus((previous) => apply(statusResult, previous));
      setCore((previous) => apply(coreResult, previous));
      setSettlements((previous) => apply(settlementResult, previous));
      setStats((previous) => apply(statsResult, previous));
      setEvents((previous) => apply(eventsResult, previous));
    }

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, range, tick]);

  useEffect(() => {
    const body = core.data;
    if (!body || body.status !== "available" || !body.configuration) {
      setChain({ phase: "idle" });
      return;
    }
    const batches = batchesFromCoreEvents(body.events ?? []);
    const frontier = checkFrontier(batches);
    if (frontier.completeFromZero) {
      setChain({
        phase: "skipped",
        reason: "The core event list connects back to round 0, so no Sepolia log scan was needed.",
      });
      return;
    }
    if (frontier.batchCount === 0) {
      setChain({ phase: "skipped", reason: "The core response listed no BatchSettled events to extend." });
      return;
    }
    let cancelled = false;
    setChain({ phase: "loading" });
    const rpc = import.meta.env.VITE_SEPOLIA_RPC;
    void import("./lib/chain.ts")
      .then(({ readSettlementBatches }) => readSettlementBatches(body, rpc))
      .then((logs) => {
        if (cancelled) return;
        setChain({ phase: "ready", batches: logs });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setChain({ phase: "error", message: asError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [core.data]);

  const value = useMemo<SqueekContextValue>(
    () => ({
      status,
      core,
      settlements,
      stats,
      events,
      range,
      setRange,
      refresh: () => setTick((value) => value + 1),
      chain,
      apiBase,
    }),
    [status, core, settlements, stats, events, range, chain],
  );

  return <SqueekContext.Provider value={value}>{children}</SqueekContext.Provider>;
}

export function useSqueek(): SqueekContextValue {
  const value = useContext(SqueekContext);
  if (!value) throw new Error("useSqueek must be used inside SqueekProvider");
  return value;
}
