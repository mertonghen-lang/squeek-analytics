import { Note, Panel } from "../components/States.tsx";
import { useSqueek } from "../data.tsx";
import { DOCS_SNAPSHOT, formatWhen, shortAddress } from "../lib/format.ts";

const rows = [
  ["Work history", "GET /v1/measurement/stats?range=7d|30d", "Half-hour accepted work, coverage, lifetime totals"],
  ["Work history", "GET /v1/status", "Open-round counter, optimistic projection, freshness"],
  ["Work history", "GET /v1/core", "Settled cumulative work and difficulty for the integer check"],
  ["Block milestones", "GET /v1/core", "Ledger, configuration, BatchSettled events"],
  ["Block milestones", "GET /v1/settlements?range=24h", "Daily summary. recentSettlements lists only batches that completed blocks"],
  ["Block milestones", "GET /v1/status", "Optimistic height, labeled as not settled"],
  ["Settlement lag", "GET /v1/core events", "Round end versus BatchSettled block time"],
  ["Settlement lag", "GET /v1/settlements", "Checkpoint times, joined on the frontier round"],
  ["Settlement lag", "GET /v1/status", "Queued closed rounds still waiting, plus the latest submission"],
  ["Settlement lag", "Sepolia eth_getLogs", "Only if core events do not connect back to round 0"],
  ["Hamster", "GET /v1/status", "Latest rpm, speed, distance, freshness, modules"],
  ["Hamster", "GET /v1/measurement/stats", "Records, round mix, typical day, coverage"],
  ["Hamster", "GET /v1/events?category=measurement", "Speed and distance milestones"],
];

export function Sources() {
  const { core, settlements, apiBase } = useSqueek();
  const liveCore = core.data?.status === "available" ? core.data.identities?.core : undefined;
  const liveBlock = core.data?.chain?.deploymentBlock;
  const mining = settlements.data?.mining?.economy;

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Sources</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">Read-only, and unofficial</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Squeek Analytics is a community reading of the public work record. It is not the Squeek Chain console, not an operator, and not a place to claim, merge, or sign anything. Contract addresses are taken from the API response at runtime.
        </p>
      </div>

      <Panel title="What each view calls">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-3 font-medium">View</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-line">
                  <td className="py-2 pr-3">{row[0]}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row[1]}</td>
                  <td className="py-2 text-muted">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">API base for this session: {apiBase}. The dev server may proxy that path onto https://api.squeekchain.com. A static build calls the API directly from the browser.</p>
      </Panel>

      <Panel title="Deployment the API is serving" eyebrow="Compared with the docs snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          <Note>
            Docs snapshot SqueekCore {DOCS_SNAPSHOT.core}, deployment block {DOCS_SNAPSHOT.deploymentBlock}. Mining {shortAddress(DOCS_SNAPSHOT.mining)}, SQK {shortAddress(DOCS_SNAPSHOT.token)}, NFT {shortAddress(DOCS_SNAPSHOT.nft)}.
          </Note>
          <Note>
            Live /v1/core reports {liveCore ?? "no core address yet"} at deployment block {liveBlock ?? "—"}.
            {mining?.mining ? ` Settlements name mining ${mining.mining} and ${mining.symbol ?? "token"} ${mining.token ?? ""}.` : ""}
            {core.data?.chain?.safeBlockTimestamp ? ` Safe block time ${formatWhen(core.data.chain.safeBlockTimestamp)}.` : ""}
          </Note>
        </div>
        <p className="mt-3 text-sm text-muted">
          The attached docs describe an earlier Sepolia graph (core implementation version 3 at the docs proxy, mining version 6). The live indexer can be a later deployment, with a different core proxy and a mining contract the events feed reports at a higher implementation version. This site does not hard-code either set of addresses for reads.
        </p>
      </Panel>

      <Panel title="Limits worth keeping">
        <ul className="grid list-disc gap-2 pl-5 text-sm leading-6 text-muted">
          <li>HTTP 200 with status unavailable is unknown, not an empty chart.</li>
          <li>A missing round is not zero work. A zero-work round was closed with no accepted passages, including time the Pi was stopped.</li>
          <li>Optimistic projections are not settled work and have not issued SQK.</li>
          <li>Chain data here is about 12 confirmations behind the tip.</li>
          <li>GET /v1/mining/state and the owner routes are typed in the client. This site does not depend on them; mining state has returned 404.</li>
          <li>The page refetches about once a minute, inside the published cache windows, and backs off on 429 and 503.</li>
        </ul>
      </Panel>
    </div>
  );
}
