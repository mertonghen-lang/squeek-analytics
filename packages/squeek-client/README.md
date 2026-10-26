# @squeek-analytics/client

Read-only TypeScript client for the public [Squeek Chain HTTP API](https://docs.squeekchain.com/developers/api/). It is the library under [Squeek Analytics](../../README.md). It does not sign transactions, hold keys, or talk to a wallet.

The package is private to this repo (`"private": true`). It is not published to npm.

## Install

From the repository root:

```sh
pnpm install
pnpm --filter @squeek-analytics/client test
pnpm --filter @squeek-analytics/client typecheck
```

The site consumes the TypeScript source through the workspace. `pnpm --filter @squeek-analytics/client build` also emits `dist/` for a plain Node import.

## Usage

```ts
import { SqueekClient, toUint, settlementLags, batchesFromCoreEvents } from "@squeek-analytics/client";

const client = new SqueekClient({ baseUrl: "https://api.squeekchain.com" });

const status = await client.getStatus();
const openRound = status.measurement
  ? toUint(status.measurement.cumulativeWorkUnits)
  : null;

const core = await client.getCore();
if (core.status === "available" && core.configuration && core.events) {
  const batches = batchesFromCoreEvents(core.events);
  const lags = settlementLags(
    batches,
    toUint(core.configuration.genesisTimestamp),
    toUint(core.configuration.roundDuration),
  );
  console.log(lags.map((lag) => lag.frontierLagSeconds));
}

const week = await client.getMeasurementStats("7d");
const day = await client.getSettlements("24h");
const feed = await client.collectEvents({ category: "measurement", limit: 50 }, { maxPages: 3 });
```

`cumulativeWorkUnits`, block units, round ids, and SQK base units stay **strings** on the response. `toUint` parses a canonical unsigned decimal into a `bigint` and rejects leading zeros, fractions, and exponents. `JSON.parse` is called with no reviver, so a 50-digit work total cannot collapse into a JavaScript number inside the client.

## Endpoints

| Method | HTTP | Notes |
|---|---|---|
| `getStatus()` | `GET /v1/status` | No query string. |
| `getCore()` | `GET /v1/core` | No query string. Includes the newest core events. |
| `getMeasurementStats(range)` | `GET /v1/measurement/stats?range=` | `7d` or `30d`. |
| `getSettlements(range)` | `GET /v1/settlements?range=` | `now` (default), `24h`, `7d`, `30d`. |
| `getEvents({ category, limit, cursor })` | `GET /v1/events` | `limit` 1–100. `collectEvents` follows `nextCursor`. |
| `getMiningState()` | `GET /v1/mining/state` | Documented. The live service has returned `404 not_found`. |
| `getEconomyState()` | `GET /v1/economy/state` | Seen live. Not in the attached docs snapshot. |
| `getOwnerSqueeks(address)` | `GET /v1/owners/{address}/squeeks` | Typed for callers. The site does not use it. |
| `getOwnerActivity(address)` | `GET /v1/owners/{address}/activity` | Same. |
| `getSqueekMetadata(tokenId)` | `GET /v1/squeeks/{tokenId}/metadata` | Token ids 1–9999. |

An HTTP 200 body with `"status": "unavailable"` is returned, not thrown. Show `reason`. Do not treat it as zero.

HTTP errors become `SqueekApiError` (`status`, `code`, `requestId`, `retryAfterSeconds`). Documented codes include `invalid_query`, `not_found`, `rate_limited`, `invalid_cursor`, `invalid_address`, and `invalid_token_id`. The client retries `429`, `503`, and `504` up to three times and waits on `Retry-After`, capped at 8 seconds. Responses that are not JSON become `SqueekResponseError`.

ETags are stored in memory. A later `304` returns the cached JSON. Pass `cache: false` to disable that.

The client sends `X-Request-Id`. Pagination cursors are opaque. `collectPages` stops if a cursor repeats.

## Derived helpers

These are pure functions over the documented integers. They do not invent measurements.

- `priceThenSteer(work, difficulty, cumulativeBlockUnits)` — SqueekCore's price-then-steer rule.
- `workSeries(stats)` — half-hour buckets in chronological order. A noon-based day lists minutes `0–690` before `720–1410` in the payload; the helper reorders them. Missing and future buckets stay `null`, never `0`.
- `batchesFromCoreEvents` / `settlementLags` / `checkFrontier` — certification delay from round end to the Ethereum block timestamp.
- `impliedCircumferenceMm(rpmMilli, speedMmPerSecond)` — whole millimetres implied by one paired reading. Null when rpm is 0.
- `quantile`, `blockSplit`, `timeToUnixSeconds`, `speedHundredthsOfKmh`.

## What this library does not do

It does not call Sepolia. The site uses viem separately, and only when `/v1/core` events do not already cover the frontier back to round 0. It does not prepare claims, merges, or any other transaction.
