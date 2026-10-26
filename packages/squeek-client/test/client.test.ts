import { describe, expect, it, vi } from "vitest";
import { SqueekApiError, SqueekClient, SqueekResponseError, toUint } from "../src/index.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("SqueekClient", () => {
  it("keeps decimal strings intact and builds the documented paths", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/status")) {
        return jsonResponse({
          schemaVersion: 1,
          generatedAt: "2026-10-26T21:18:28.487Z",
          measurement: { cumulativeWorkUnits: "123456789012345678901234567890" },
          builder: { status: "available" },
          oracle: { state: "accepted", reason: null },
          settlementQueue: { status: "available" },
        });
      }
      if (url.includes("/v1/measurement/stats?range=7d")) {
        return jsonResponse({ schemaVersion: 1, generatedAt: "2026-10-26T00:00:00.000Z", range: "7d" });
      }
      if (url.includes("/v1/settlements?range=24h")) {
        return jsonResponse({ schemaVersion: 3, status: "available", range: "24h" });
      }
      throw new Error(`unexpected ${url}`);
    });

    const client = new SqueekClient({
      baseUrl: "https://api.example.test/root",
      fetch: fetchMock as typeof fetch,
      cache: false,
    });
    const status = await client.getStatus();
    expect(status.measurement?.cumulativeWorkUnits).toBe("123456789012345678901234567890");
    expect(toUint(status.measurement?.cumulativeWorkUnits ?? "0").toString()).toBe(
      "123456789012345678901234567890",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.example.test/root/v1/status");
    await client.getMeasurementStats("7d");
    await client.getSettlements("24h");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/v1/measurement/stats?range=7d");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/v1/settlements?range=24h");
  });

  it("returns an HTTP 200 unavailable body instead of throwing", async () => {
    const client = new SqueekClient({
      fetch: (async () => jsonResponse({ schemaVersion: 1, status: "unavailable", reason: "not_yet_safe" })) as typeof fetch,
      cache: false,
    });
    const core = await client.getCore();
    expect(core.status).toBe("unavailable");
    expect(core.reason).toBe("not_yet_safe");
  });

  it("throws SqueekApiError with the documented error code and request id", async () => {
    const client = new SqueekClient({
      fetch: (async () =>
        jsonResponse({ error: "invalid_query" }, 400, { "x-request-id": "req-7" })) as typeof fetch,
      cache: false,
    });
    await expect(client.getSettlements()).rejects.toMatchObject({
      name: "SqueekApiError",
      status: 400,
      code: "invalid_query",
      requestId: "req-7",
    });
  });

  it("surfaces a 404 from the documented mining route", async () => {
    const client = new SqueekClient({
      fetch: (async () => jsonResponse({ error: "not_found" }, 404)) as typeof fetch,
      cache: false,
    });
    await expect(client.getMiningState()).rejects.toBeInstanceOf(SqueekApiError);
    await expect(client.getMiningState()).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("retries 429 using Retry-After and then returns the body", async () => {
    let calls = 0;
    const sleep = vi.fn(async () => {});
    const client = new SqueekClient({
      sleep,
      cache: false,
      fetch: (async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({ error: "rate_limited" }, 429, { "retry-after": "0" });
        return jsonResponse({ schemaVersion: 2, status: "available" });
      }) as typeof fetch,
    });
    const economy = await client.getEconomyState();
    expect(economy.status).toBe("available");
    expect(sleep).toHaveBeenCalledWith(0);
    expect(calls).toBe(2);
  });

  it("replays a cached body on 304", async () => {
    let calls = 0;
    const client = new SqueekClient({
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        const headers = new Headers(init?.headers);
        if (calls === 1) return jsonResponse({ schemaVersion: 1, status: "available", core: { cumulativeWork: "9" } }, 200, { etag: '"abc"' });
        expect(headers.get("if-none-match")).toBe('"abc"');
        return new Response(null, { status: 304, headers: { etag: '"abc"' } });
      }) as typeof fetch,
    });
    const first = await client.getCore();
    const second = await client.getCore();
    expect(second.core?.cumulativeWork).toBe("9");
    expect(second).toEqual(first);
    expect(calls).toBe(2);
  });

  it("rejects a non-JSON success body", async () => {
    const client = new SqueekClient({
      fetch: (async () => new Response("<html>challenge</html>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch,
      cache: false,
    });
    await expect(client.getStatus()).rejects.toBeInstanceOf(SqueekResponseError);
  });

  it("pages the event feed and stops on a null cursor", async () => {
    const client = new SqueekClient({
      cache: false,
      fetch: (async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const cursor = url.searchParams.get("cursor");
        if (cursor == null) {
          return jsonResponse({
            schemaVersion: 1,
            status: "available",
            nextCursor: "cursor-2",
            events: [{ id: "a", occurredAt: "t", recordedAt: "t", source: { kind: "measurement" }, type: "measurement.speed_milestone", payload: { observedSpeedMmPerSecond: "1526" } }],
          });
        }
        expect(cursor).toBe("cursor-2");
        return jsonResponse({
          schemaVersion: 1,
          status: "available",
          nextCursor: null,
          events: [{ id: "b", occurredAt: "t", recordedAt: "t", source: { kind: "chain" }, type: "system.settlement_completed", payload: {} }],
        });
      }) as typeof fetch,
    });
    const events = await client.collectEvents({ category: "all", limit: 20 });
    expect(events.map((event) => event.id)).toEqual(["a", "b"]);
  });

  it("rejects a bad owner address and an out-of-range limit before fetching", async () => {
    const fetchMock = vi.fn();
    const client = new SqueekClient({ fetch: fetchMock as typeof fetch });
    await expect(client.getOwnerSqueeks("not-an-address")).rejects.toMatchObject({ code: "invalid_address", status: 0 });
    await expect(client.getOwnerActivity("0x" + "ab".repeat(20), { limit: 101 })).rejects.toMatchObject({
      code: "invalid_query",
    });
    await expect(client.getSqueekMetadata("0")).rejects.toMatchObject({ code: "invalid_token_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
