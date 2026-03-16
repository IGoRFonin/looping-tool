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
 * Known vault token addresses (lowercase) → symbol for matching.
 * These are the actual ERC-4626 vault contract addresses on Ethereum.
 */
const KNOWN_VAULTS: Record<string, string> = {
  "0x9d39a5de30e57443bff2a8307a4256c8797a3497": "SUSDE",
  "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd": "SUSDS",
  "0x356b8d89c1e1239cbbb9de4815c39a1474d5ba7d": "SYRUPUSDT",
  "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b": "SYRUPUSDC",
};

/**
 * Fetch yield pools from DeFiLlama and return a map of
 * lowercase vault address → APY as decimal.
 *
 * Strategy: match DeFiLlama pools by symbol to known vault addresses.
 * For each symbol, pick the pool from the native project (highest TVL)
 * that has a nonzero APY.
 */
export async function fetchDefiLlamaYields(): Promise<Map<string, number>> {
  const yieldMap = new Map<string, number>();

  try {
    const proxyFetch = getProxyFetch();
    const response = await proxyFetch(DEFILLAMA_POOLS_URL);

    if (!response.ok) {
      console.error(`DeFiLlama API returned ${response.status}`);
      return yieldMap;
    }

    const json = (await response.json()) as { data: DefiLlamaPool[] };
    const pools = json.data ?? [];

    // Build symbol → best pool (highest TVL with nonzero APY)
    const bestBySymbol = new Map<string, DefiLlamaPool>();

    for (const pool of pools) {
      if (pool.chain !== "Ethereum") continue;
      if (!pool.apy || pool.apy <= 0) continue;

      const sym = pool.symbol.toUpperCase();
      const existing = bestBySymbol.get(sym);
      if (!existing || pool.tvlUsd > existing.tvlUsd) {
        bestBySymbol.set(sym, pool);
      }
    }

    // Map known vault addresses to their APY
    for (const [address, symbol] of Object.entries(KNOWN_VAULTS)) {
      const pool = bestBySymbol.get(symbol);
      if (pool) {
        yieldMap.set(address, pool.apy / 100);
      }
    }

    console.log(
      `DeFiLlama: found APY for ${yieldMap.size}/${Object.keys(KNOWN_VAULTS).length} vaults`
    );
  } catch (err) {
    console.error("DeFiLlama fetch failed:", err);
  }

  return yieldMap;
}

/**
 * Returns the set of known vault addresses (lowercase).
 * Used by Morpho/Aave fetchers to identify yield-bearing collateral
 * even when DeFiLlama doesn't have APY data.
 */
export function getKnownVaultAddresses(): Set<string> {
  return new Set(Object.keys(KNOWN_VAULTS));
}
