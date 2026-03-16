import type { Market } from "@looping-tool/shared";

export async function fetchAllMarkets(): Promise<{
  markets: Market[];
  errors: string[];
}> {
  // Stub — will be implemented in subsequent tasks
  return { markets: [], errors: [] };
}
