import { SqueekApiError, SqueekResponseError } from "./errors";
import type {
  CoreResponse,
  EconomyStateResponse,
  EventCategory,
  EventsResponse,
  FeedEvent,
  MiningStateResponse,
  MeasurementStatsResponse,
  OwnerActivityResponse,
  OwnerSqueeksResponse,
  Page,
  SettlementRange,
  SettlementsResponse,
  SqueekMetadataResponse,
  StatsRange,
  StatusResponse,
} from "./types";

export const DEFAULT_BASE_URL = "https://api.squeekchain.com";

export interface SqueekClientOptions {
  /** Origin only. Paths are appended. Defaults to the public API. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Retries for 429, 503, and 504. Default 3. */
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Remember ETags and replay a cached body on 304. Default true. */
  cache?: boolean;
}

interface CacheEntry {
  etag: string;
  body: unknown;
}

const RETRY_STATUSES = new Set([429, 503, 504]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `squeek-${crypto.randomUUID()}`;
  return `squeek-${Date.now().toString(36)}`;
}

function assertLimit(limit: number | undefined, path: string): void {
  if (limit === undefined) return;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new SqueekApiError({
      status: 0,
      code: "invalid_query",
      path,
      message: `${path}: limit must be an integer from 1 to 100`,
    });
  }
}

function assertAddress(address: string, path: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) {
    throw new SqueekApiError({
      status: 0,
      code: "invalid_address",
      path,
      message: `${path}: address must be 0x and 40 hex digits, and not the zero address`,
    });
  }
}

function assertTokenId(tokenId: string, path: string): void {
  if (!/^[1-9]\d{0,3}$/.test(tokenId) || Number(tokenId) > 9999) {
    throw new SqueekApiError({
      status: 0,
      code: "invalid_token_id",
      path,
      message: `${path}: token id must be an integer from 1 to 9999 without leading zeros`,
    });
  }
}

export class SqueekClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly useCache: boolean;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: SqueekClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
    this.maxRetries = options.maxRetries ?? 3;
    this.sleep = options.sleep ?? defaultSleep;
    this.useCache = options.cache ?? true;
  }

  getStatus(): Promise<StatusResponse> {
    return this.get<StatusResponse>("/v1/status");
  }

  getCore(): Promise<CoreResponse> {
    return this.get<CoreResponse>("/v1/core");
  }

  getMeasurementStats(range: StatsRange): Promise<MeasurementStatsResponse> {
    return this.get<MeasurementStatsResponse>("/v1/measurement/stats", { range });
  }

  getSettlements(range: SettlementRange = "now"): Promise<SettlementsResponse> {
    return this.get<SettlementsResponse>("/v1/settlements", { range });
  }

  async getEvents(query: { category?: EventCategory; limit?: number; cursor?: string } = {}): Promise<EventsResponse> {
    assertLimit(query.limit, "/v1/events");
    return this.get<EventsResponse>("/v1/events", {
      category: query.category,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  /** Documented issuance route. Live deployments may answer 404; that is returned as {@link SqueekApiError}. */
  getMiningState(): Promise<MiningStateResponse> {
    return this.get<MiningStateResponse>("/v1/mining/state");
  }

  /**
   * Live economy route observed at `/v1/economy/state`. It is not in the attached docs snapshot.
   * Treat a 404 as "this deployment does not expose it".
   */
  getEconomyState(): Promise<EconomyStateResponse> {
    return this.get<EconomyStateResponse>("/v1/economy/state");
  }

  async getOwnerSqueeks(
    address: string,
    query: { limit?: number; cursor?: string } = {},
  ): Promise<OwnerSqueeksResponse> {
    const path = `/v1/owners/${address}/squeeks`;
    assertAddress(address, path);
    assertLimit(query.limit, path);
    return this.get<OwnerSqueeksResponse>(path, query);
  }

  async getOwnerActivity(
    address: string,
    query: { limit?: number; cursor?: string } = {},
  ): Promise<OwnerActivityResponse> {
    const path = `/v1/owners/${address}/activity`;
    assertAddress(address, path);
    assertLimit(query.limit, path);
    return this.get<OwnerActivityResponse>(path, query);
  }

  async getSqueekMetadata(tokenId: string, query: { release?: string } = {}): Promise<SqueekMetadataResponse> {
    const path = `/v1/squeeks/${tokenId}/metadata`;
    assertTokenId(tokenId, path);
    return this.get<SqueekMetadataResponse>(path, query);
  }

  /** Follow `nextCursor` until it is null, a page cap is hit, or a cursor repeats. */
  async collectEvents(
    query: { category?: EventCategory; limit?: number } = {},
    options: { maxPages?: number } = {},
  ): Promise<FeedEvent[]> {
    const pages = await collectPages<FeedEvent>({
      maxPages: options.maxPages ?? 10,
      fetchPage: async (cursor) => {
        const page = await this.getEvents({ ...query, cursor });
        if (page.status === "unavailable") {
          throw new SqueekApiError({
            status: 200,
            code: page.reason ?? "unavailable",
            path: "/v1/events",
            message: `/v1/events unavailable: ${page.reason ?? "unknown"}`,
          });
        }
        return { items: page.events ?? [], nextCursor: page.nextCursor };
      },
    });
    return pages;
  }

  private async get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(joinUrl(this.baseUrl, path), typeof window !== "undefined" ? window.location.href : undefined);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    if (search) url.search = search;
    const href = url.toString();
    const id = requestId();

    for (let attempt = 0; ; attempt += 1) {
      const headers = new Headers({
        accept: "application/json",
        "x-request-id": id,
      });
      const cached = this.useCache ? this.cache.get(href) : undefined;
      if (cached) headers.set("if-none-match", cached.etag);

      const response = await this.fetchImpl(href, { headers, method: "GET" });
      const responseRequestId = response.headers.get("x-request-id") ?? id;
      const retryAfter = retryAfterSeconds(response.headers.get("retry-after"));

      if (response.status === 304) {
        if (!cached) {
          throw new SqueekResponseError(path, 304, `${path}: 304 without a cached body`);
        }
        return cached.body as T;
      }

      if (RETRY_STATUSES.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(Math.min(retryAfter ?? 1, 8) * 1000);
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new SqueekApiError({
          status: response.status,
          code: errorCode(text) ?? `http_${response.status}`,
          path,
          requestId: responseRequestId,
          retryAfterSeconds: retryAfter,
        });
      }

      let body: unknown;
      if (text === "") {
        throw new SqueekResponseError(path, response.status, `${path}: empty JSON body`);
      }
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new SqueekResponseError(path, response.status, `${path}: response was not JSON`);
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new SqueekResponseError(path, response.status, `${path}: JSON body was not an object`);
      }
      const etag = response.headers.get("etag");
      if (this.useCache && etag) this.cache.set(href, { etag, body });
      return body as T;
    }
  }
}

export async function collectPages<T>(options: {
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>;
  maxPages?: number;
}): Promise<T[]> {
  const maxPages = options.maxPages ?? 20;
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await options.fetchPage(cursor);
    items.push(...result.items);
    if (result.nextCursor == null) return items;
    if (seen.has(result.nextCursor)) {
      throw new SqueekApiError({
        status: 0,
        code: "invalid_cursor",
        path: "pagination",
        message: "pagination cursor repeated; stopped to avoid a loop",
      });
    }
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  return items;
}

function joinUrl(base: string, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${suffix}`;
}

function retryAfterSeconds(header: string | null): number | null {
  if (header == null || header === "") return null;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

function errorCode(text: string): string | null {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
