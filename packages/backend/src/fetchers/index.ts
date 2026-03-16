import type { Market } from "@looping-tool/shared";
import { fetchMorphoMarkets } from "./morpho.js";
import { fetchAaveMarkets } from "./aave.js";
import { fetchDefiLlamaYields, getKnownVaultAddresses } from "./defillama.js";

export async function fetchAllMarkets(): Promise<{
  markets: Market[];
  errors: string[];
}> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    return { markets: [], errors: ["RPC_URL not configured"] };
  }

  // Known yield-bearing vault addresses
  const vaultAddresses = getKnownVaultAddresses();

  // Step 1: Fetch yield rates from DeFiLlama (address → APY as decimal)
  const yieldRates = await fetchDefiLlamaYields();

  // Step 2: Fetch from both protocols in parallel (auto-discover pairs)
  const [morphoResult, aaveResult] = await Promise.all([
    fetchMorphoMarkets(vaultAddresses, yieldRates),
    fetchAaveMarkets(vaultAddresses, yieldRates, rpcUrl),
  ]);

  const markets = [...morphoResult.markets, ...aaveResult.markets];
  const errors: string[] = [];
  if (morphoResult.error) errors.push(morphoResult.error);
  if (aaveResult.error) errors.push(aaveResult.error);

  return { markets, errors };
}
