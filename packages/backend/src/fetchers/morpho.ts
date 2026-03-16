import { gql, GraphQLClient } from "graphql-request";
import type { Market, PairConfig } from "@looping-tool/shared";
import { getProxyFetch } from "../proxy.js";

const MORPHO_API = "https://api.morpho.org/graphql";

const MARKETS_QUERY = gql`
  query GetMarkets($marketIds: [String!]!) {
    markets(where: { uniqueKey_in: $marketIds, chainId_in: [1] }) {
      items {
        uniqueKey
        lltv
        collateralAsset {
          symbol
          address
        }
        loanAsset {
          symbol
          address
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
  collateralAsset: { symbol: string; address: string };
  loanAsset: { symbol: string; address: string };
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
    },
    borrowAsset: {
      symbol: apiMarket.loanAsset.symbol,
      address: apiMarket.loanAsset.address,
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
 * Fetch markets from Morpho GraphQL API for the given pair configs.
 * Returns markets array + any errors encountered.
 */
export async function fetchMorphoMarkets(
  pairs: PairConfig[],
  yieldRates: Map<string, number | null>
): Promise<{ markets: Market[]; error?: string }> {
  const morphoPairs = pairs.filter((p) => p.protocol === "morpho" && p.marketId);
  if (morphoPairs.length === 0) return { markets: [] };

  const marketIds = morphoPairs.map((p) => p.marketId!);

  try {
    const client = new GraphQLClient(MORPHO_API, { fetch: getProxyFetch() });
    const data = await client.request<{
      markets: { items: MorphoApiMarket[] };
    }>(MARKETS_QUERY, { marketIds });

    const markets = data.markets.items.map((item) => {
      const collateralAPY = yieldRates.get(item.collateralAsset.symbol) ?? null;
      return transformMorphoMarket(item, collateralAPY);
    });

    return { markets };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Morpho fetch failed:", message);
    return { markets: [], error: "morpho_fetch_failed" };
  }
}
