import type { Market } from "@looping-tool/shared";
import { fetchMorphoMarkets } from "./morpho.js";
import { fetchAaveMarkets } from "./aave.js";
import { fetchDefiLlamaYields } from "./defillama.js";

export async function fetchAllMarkets(): Promise<{
  markets: Market[];
  errors: string[];
}> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    return { markets: [], errors: ["RPC_URL not configured"] };
  }

  // Step 1: Fetch yield vaults from DeFiLlama (address → APY as decimal)
  const yieldVaults = await fetchDefiLlamaYields();

  // Step 2: Fetch from both protocols in parallel (auto-discover pairs)
  const [morphoResult, aaveResult] = await Promise.all([
    fetchMorphoMarkets(yieldVaults),
    fetchAaveMarkets(yieldVaults, rpcUrl),
  ]);

  const markets = [...morphoResult.markets, ...aaveResult.markets];
  const errors: string[] = [];
  if (morphoResult.error) errors.push(morphoResult.error);
  if (aaveResult.error) errors.push(aaveResult.error);

  return { markets, errors };
}
