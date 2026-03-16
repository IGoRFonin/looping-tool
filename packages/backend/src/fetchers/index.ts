// packages/backend/src/fetchers/index.ts
import type { Market } from "@looping-tool/shared";
import { fetchMorphoMarkets } from "./morpho.js";
import { fetchAaveMarkets } from "./aave.js";
import { fetchYieldRates } from "./yield.js";
import pairsConfig from "../config/pairs.json" with { type: "json" };
import type { PairConfig } from "@looping-tool/shared";

const pairs = pairsConfig as PairConfig[];

export async function fetchAllMarkets(): Promise<{
  markets: Market[];
  errors: string[];
}> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    return { markets: [], errors: ["RPC_URL not configured"] };
  }

  // Step 1: Fetch yield rates for all vaults
  const yieldRates = await fetchYieldRates(rpcUrl);

  // Step 2: Fetch from both protocols in parallel
  const [morphoResult, aaveResult] = await Promise.all([
    fetchMorphoMarkets(pairs, yieldRates),
    fetchAaveMarkets(pairs, yieldRates, rpcUrl),
  ]);

  const markets = [...morphoResult.markets, ...aaveResult.markets];
  const errors: string[] = [];
  if (morphoResult.error) errors.push(morphoResult.error);
  if (aaveResult.error) errors.push(aaveResult.error);

  return { markets, errors };
}
