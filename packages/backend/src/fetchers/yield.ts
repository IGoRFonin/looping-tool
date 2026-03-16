import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { GraphQLClient, gql } from "graphql-request";
import vaultsConfig from "../config/vaults.json" with { type: "json" };
import { getProxyFetch } from "../proxy.js";

const MORPHO_API = "https://api.morpho.org/graphql";

const ERC4626_ABI = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

/**
 * Compute APY from two exchange rate snapshots.
 * rate = assets per share (e.g., convertToAssets(1e18) / 1e18)
 */
export function computeApyFromExchangeRates(
  oldRate: number,
  newRate: number,
  elapsedSeconds: number
): number {
  if (oldRate === 0 || elapsedSeconds === 0) return 0;
  const periodReturn = (newRate - oldRate) / oldRate;
  if (periodReturn === 0) return 0;

  const periodsPerYear = SECONDS_PER_YEAR / elapsedSeconds;
  return Math.pow(1 + periodReturn, periodsPerYear) - 1;
}

/**
 * Try to get yield rates from Morpho API first.
 * Returns a map of symbol → APY (decimal).
 */
async function fetchYieldFromMorphoApi(
  symbols: string[]
): Promise<Map<string, number>> {
  const rates = new Map<string, number>();
  const addresses = symbols
    .filter((s) => s in vaultsConfig)
    .map((s) => ({
      symbol: s,
      address: (vaultsConfig as Record<string, { address: string }>)[s].address,
    }));

  if (addresses.length === 0) return rates;

  try {
    const client = new GraphQLClient(MORPHO_API, { fetch: getProxyFetch() });
    const query = gql`
      query GetAssets($addresses: [String!]!) {
        assets(where: { address_in: $addresses, chainId_in: [1] }) {
          items {
            address
            symbol
            yield {
              apr
            }
          }
        }
      }
    `;

    const data = await client.request<{
      assets: {
        items: Array<{
          address: string;
          symbol: string;
          yield?: { apr: number };
        }>;
      };
    }>(query, { addresses: addresses.map((a) => a.address) });

    for (const asset of data.assets.items) {
      if (asset.yield?.apr != null) {
        const entry = addresses.find(
          (a) => a.address.toLowerCase() === asset.address.toLowerCase()
        );
        if (entry) {
          const apr = asset.yield.apr;
          const apy = Math.exp(apr) - 1;
          rates.set(entry.symbol, apy);
        }
      }
    }
  } catch (err) {
    console.warn("Morpho API yield fetch failed, will use RPC fallback:", err);
  }

  return rates;
}

/**
 * Fallback: read exchange rate from ERC-4626 vault on-chain.
 */
const rateSnapshots = new Map<string, { rate: number; timestamp: number }>();

async function fetchYieldFromRpc(
  symbol: string,
  vaultAddress: string,
  rpcUrl: string
): Promise<number | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { fetch: getProxyFetch() }),
    });

    const decimals = await client.readContract({
      address: vaultAddress as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "decimals",
    });

    const shares = BigInt(10) ** BigInt(decimals);
    const assets = await client.readContract({
      address: vaultAddress as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "convertToAssets",
      args: [shares],
    });

    const currentRate = Number(assets) / Number(shares);
    const now = Math.floor(Date.now() / 1000);

    const prev = rateSnapshots.get(symbol);
    rateSnapshots.set(symbol, { rate: currentRate, timestamp: now });

    if (!prev) return null;

    const elapsed = now - prev.timestamp;
    if (elapsed < 60) return null;

    return computeApyFromExchangeRates(prev.rate, currentRate, elapsed);
  } catch (err) {
    console.warn(`RPC yield fetch failed for ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch yield rates for all configured vaults.
 * Primary: Morpho API. Fallback: ERC-4626 RPC.
 */
export async function fetchYieldRates(
  rpcUrl: string
): Promise<Map<string, number | null>> {
  const symbols = Object.keys(vaultsConfig);
  const rates = new Map<string, number | null>();

  const apiRates = await fetchYieldFromMorphoApi(symbols);

  for (const symbol of symbols) {
    if (apiRates.has(symbol)) {
      rates.set(symbol, apiRates.get(symbol)!);
    } else {
      const vault = (vaultsConfig as Record<string, { address: string }>)[symbol];
      const rpcRate = await fetchYieldFromRpc(symbol, vault.address, rpcUrl);
      rates.set(symbol, rpcRate);
    }
  }

  return rates;
}
