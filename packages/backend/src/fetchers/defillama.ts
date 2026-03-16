import { getProxyFetch } from "../proxy.js";

const DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools";

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  underlyingTokens?: string[];
}

/**
 * Fetch all yield pools from DeFiLlama and return a map of
 * lowercase pool address → APY as decimal (e.g. 3.42% → 0.0342).
 * Filters to Ethereum chain only.
 */
export async function fetchDefiLlamaYields(): Promise<Map<string, number>> {
  const proxyFetch = getProxyFetch();
  const response = await proxyFetch(DEFILLAMA_POOLS_URL);

  if (!response.ok) {
    throw new Error(`DeFiLlama API returned ${response.status}: ${response.statusText}`);
  }

  const json = await response.json() as { data: DefiLlamaPool[] };
  const pools: DefiLlamaPool[] = json.data ?? [];

  const yieldMap = new Map<string, number>();

  for (const pool of pools) {
    if (pool.chain !== "Ethereum") continue;
    if (pool.apy == null || !pool.pool) continue;

    const address = pool.pool.toLowerCase();
    // Convert percent (3.42) to decimal (0.0342)
    const apyDecimal = pool.apy / 100;
    yieldMap.set(address, apyDecimal);
  }

  return yieldMap;
}
