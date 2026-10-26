import {
  batchesFromCoreEvents,
  toUint,
  type CoreResponse,
  type NormalizedBatch,
} from "@squeek-analytics/client";
import { createPublicClient, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const batchSettled = parseAbiItem(
  "event BatchSettled(bytes32 indexed digest, address indexed reporter, uint64 indexed settledThroughRound, uint256 nonce, uint64 previousSettledThroughRound, uint16 activeRoundCount, uint64 cumulativeWork, uint96 cumulativeBlockUnits)",
);

export const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const MAX_SPAN = 50_000n;
const MAX_TIMESTAMP_LOOKUPS = 80;

/**
 * Read BatchSettled logs when `/v1/core` does not already contain the full frontier.
 * Block timestamps come from `eth_getBlockByNumber` because logs do not carry them.
 */
export async function readSettlementBatches(core: CoreResponse, rpcUrl = DEFAULT_SEPOLIA_RPC): Promise<NormalizedBatch[]> {
  const address = core.identities?.core;
  const fromBlock = core.chain?.deploymentBlock;
  const toBlock = core.chain?.safeThroughBlock;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Core response has no proxy address to scan.");
  }
  if (!fromBlock || !toBlock) throw new Error("Core response has no deployment or safe block.");
  const from = toUint(fromBlock);
  const to = toUint(toBlock);
  if (to < from) throw new Error("Safe block is behind the deployment block.");
  if (to - from > MAX_SPAN) {
    throw new Error("The deployment span is larger than 50,000 blocks, so this page will not scan it.");
  }

  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const logs = [];
  for (let start = from; start <= to; start += 2_000n) {
    const end = start + 1_999n > to ? to : start + 1_999n;
    const chunk = await client.getLogs({
      address: address as `0x${string}`,
      event: batchSettled,
      fromBlock: start,
      toBlock: end,
    });
    logs.push(...chunk);
  }

  const blocks = new Map<bigint, bigint>();
  const unique = [...new Set(logs.map((log) => log.blockNumber).filter((value): value is bigint => value != null))];
  if (unique.length > MAX_TIMESTAMP_LOOKUPS) {
    throw new Error(`Refusing to timestamp ${unique.length} blocks from a public RPC.`);
  }
  for (const blockNumber of unique) {
    const block = await client.getBlock({ blockNumber });
    blocks.set(blockNumber, block.timestamp);
  }

  const events = logs.flatMap((log) => {
    const args = log.args;
    if (
      args.settledThroughRound == null ||
      args.previousSettledThroughRound == null ||
      log.blockNumber == null ||
      !log.transactionHash
    ) {
      return [];
    }
    const timestamp = blocks.get(log.blockNumber);
    if (timestamp == null) return [];
    return [
      {
        id: `${log.transactionHash}:${log.logIndex ?? 0}`,
        contractKind: "core",
        contractAddress: address,
        eventName: "BatchSettled",
        blockNumber: log.blockNumber.toString(),
        blockHash: log.blockHash ?? "0x",
        blockTimestamp: timestamp.toString(),
        transactionHash: log.transactionHash,
        transactionIndex: (log.transactionIndex ?? 0).toString(),
        logIndex: (log.logIndex ?? 0).toString(),
        arguments: [
          { name: "settledThroughRound", value: args.settledThroughRound.toString() },
          { name: "previousSettledThroughRound", value: args.previousSettledThroughRound.toString() },
          { name: "activeRoundCount", value: BigInt(args.activeRoundCount ?? 0).toString() },
          { name: "cumulativeWork", value: (args.cumulativeWork ?? 0n).toString() },
          { name: "cumulativeBlockUnits", value: (args.cumulativeBlockUnits ?? 0n).toString() },
        ],
      },
    ];
  });

  return batchesFromCoreEvents(events);
}
