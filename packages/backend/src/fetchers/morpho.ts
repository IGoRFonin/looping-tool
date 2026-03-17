import { gql, GraphQLClient } from "graphql-request";
import type { Market } from "@looping-tool/shared";
import { getProxyFetch } from "../proxy.js";
import { BORROW_STABLECOINS } from "../config/stablecoins.js";

const MORPHO_API = "https://api.morpho.org/graphql";

/**
 * Query all Morpho markets on Ethereum, sorted by supply.
 * Collateral filtering is done in-memory against the yieldVaults map.
 */
const MARKETS_QUERY = gql`
  query {
    markets(where: { chainId_in: [1] }, first: 500, orderBy: SupplyAssetsUsd, orderDirection: Desc) {
      items {
        uniqueKey
        lltv
        collateralAsset {
          symbol
          address
          decimals
        }
        loanAsset {
          symbol
          address
          decimals
        }
        state {
          borrowApy
          supplyApy
          liquidityAssetsUsd
          utilization
        }
      }
    }
  }
`;

interface MorphoApiMarket {
  uniqueKey: string;
  lltv: string;
  collateralAsset: { symbol: string; address: string; decimals: number };
  loanAsset: { symbol: string; address: string; decimals: number };
  state: {
    borrowApy: number;
    supplyApy: number;
    liquidityAssetsUsd: number;
    utilization: number;
  };
}

/**
 * Transform a Morpho API market object into our Market type.
 * lltv is returned as a WAD (18-decimal string), so we divide by 1e18.
 * For Morpho, maxLTV and liqThreshold are both set to lltv.
 */
export function transformMorphoMarket(
  apiMarket: MorphoApiMarket,
  collateralAPY: number | null
): Market {
  const lltv = Number(apiMarket.lltv) / 1e18;

  return {
    protocol: "morpho",
    network: "ethereum",
    collateralAsset: {
      symbol: apiMarket.collateralAsset.symbol,
      address: apiMarket.collateralAsset.address,
      decimals: apiMarket.collateralAsset.decimals,
    },
    borrowAsset: {
      symbol: apiMarket.loanAsset.symbol,
      address: apiMarket.loanAsset.address,
      decimals: apiMarket.loanAsset.decimals,
    },
    collateralAPY,
    borrowAPY: apiMarket.state.borrowApy,
    maxLTV: lltv,
    liqThreshold: lltv,
    availableLiquidity: apiMarket.state.liquidityAssetsUsd,
    utilization: apiMarket.state.utilization,
    marketId: apiMarket.uniqueKey,
  };
}

/**
 * Fetch all Morpho markets on Ethereum and filter to those where
 * collateral is a yield-bearing vault present in yieldVaults.
 */
export async function fetchMorphoMarkets(
  vaultAddresses: Set<string>,
  yieldRates: Map<string, number>
): Promise<{ markets: Market[]; error?: string }> {
  try {
    const client = new GraphQLClient(MORPHO_API, { fetch: getProxyFetch() });
    const data = await client.request<{
      markets: { items: MorphoApiMarket[] };
    }>(MARKETS_QUERY);

    const markets = data.markets.items
      .filter((item) => item.collateralAsset && item.loanAsset)
      .filter((item) => vaultAddresses.has(item.collateralAsset.address.toLowerCase()))
      .filter((item) => BORROW_STABLECOINS.has(item.loanAsset.symbol))
      .filter((item) => item.state.liquidityAssetsUsd >= 1_000_000)
      .map((item) => {
        const collateralAPY = yieldRates.get(item.collateralAsset.address.toLowerCase()) ?? null;
        return transformMorphoMarket(item, collateralAPY);
      });

    return { markets };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Morpho fetch failed:", message);
    return { markets: [], error: "morpho_fetch_failed" };
  }
}
