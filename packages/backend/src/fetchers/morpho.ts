import { gql, GraphQLClient } from "graphql-request";
import type { Market } from "@looping-tool/shared";
import { getProxyFetch } from "../proxy.js";
import vaultsConfig from "../config/vaults.json" with { type: "json" };

const MORPHO_API = "https://api.morpho.org/graphql";

const collateralSymbols = Object.keys(vaultsConfig);
const collateralAddresses = Object.values(vaultsConfig).map((v) => v.address);

/**
 * Query all Morpho markets where collateral is one of our yield-bearing tokens.
 * No hardcoded marketIds — discovers markets automatically.
 */
const MARKETS_QUERY = gql`
  query GetMarkets($collateralAddresses: [String!]!) {
    markets(
      where: {
        collateralAssetAddress_in: $collateralAddresses
        chainId_in: [1]
      }
      first: 100
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
    ) {
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
 * Fetch all Morpho markets where collateral is a yield-bearing token.
 * Auto-discovers markets — no hardcoded pairs needed.
 */
export async function fetchMorphoMarkets(
  yieldRates: Map<string, number | null>
): Promise<{ markets: Market[]; error?: string }> {
  if (collateralAddresses.length === 0) return { markets: [] };

  try {
    const client = new GraphQLClient(MORPHO_API, { fetch: getProxyFetch() });
    const data = await client.request<{
      markets: { items: MorphoApiMarket[] };
    }>(MARKETS_QUERY, { collateralAddresses });

    const markets = data.markets.items
      .filter((item) => item.state.liquidityAssetsUsd > 10_000) // skip dust markets
      .map((item) => {
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
