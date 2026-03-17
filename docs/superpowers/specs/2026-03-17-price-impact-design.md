# Price Impact Analysis — Design Spec

## Summary

Per-pair price impact analysis via DEX aggregator quotes. User enters deposit amount, clicks a button on a market row, backend queries Odos (primary) or Velora (fallback) and returns real price impact, effective price, output amount, and gas estimate. Frontend shows expanded row with details and recalculated entry cost / break-even.

## Providers

### Architecture

Extensible provider system in `packages/backend/src/fetchers/price-impact/`:

```
price-impact/
  providers/
    base.ts          — PriceImpactProvider interface
    odos.ts          — Odos (primary)
    velora.ts        — Velora/ParaSwap (fallback)
  index.ts           — orchestrator: Odos → on error/rate limit → Velora
  types.ts           — request/response types
```

All outbound requests go through `getProxyFetch()` (same pattern as existing fetchers) to support SOCKS5/HTTP proxy for users in restricted regions.

### Provider Interface

```typescript
interface PriceImpactProvider {
  name: string;
  getQuote(params: {
    sellToken: string;     // borrow asset address
    buyToken: string;      // collateral asset address
    sellAmountWei: string; // amount in wei (USD × leverage, converted)
    chainId: number;
  }): Promise<PriceImpactResult>;
}

interface PriceImpactResult {
  provider: string;
  priceImpact: number;       // decimal (0.0007 = 0.07%)
  outputAmount: string;      // collateral tokens received, human-readable with decimals applied (e.g. "4985.23")
  effectivePrice: number;    // price of 1 collateral unit in borrow token
  gasEstimateUsd: number;    // gas estimate in USD
}
```

### Odos

- Endpoint: `POST https://api.odos.xyz/sor/quote/v3`
- Returns `priceImpact` directly in response
- Free tier: 1 RPS, 1,000 requests/day, no API key required
- Do NOT use `likeAsset: true` — our pairs are vault-token/stablecoin (sUSDe/USDT), not stablecoin/stablecoin. This flag would restrict routing and break quotes.

### Velora (ex-ParaSwap)

- Endpoint: `GET https://api.paraswap.io/prices`
- Returns `srcAmount`, `destAmount`, `srcDecimals`, `destDecimals` in `priceRoute`
- Price impact formula: `1 - (destAmount / 10^destDecimals) / (srcAmount / 10^srcDecimals) / fairRate`, where `fairRate` is the ratio at 1-unit swap (a separate small-amount quote) or from the protocol's existing market data
- Simpler approach: Velora's `priceRoute` includes `bestRoute` details with `percent` and `exchange` — we extract effective price from `destAmount/srcAmount` and compare to market mid-price
- Free, no API key
- Activated only when Odos fails (HTTP 429 or error)

### Fallback Logic

Simple try/catch: Odos → on failure → Velora. No complex retry.

**Rate limiting**: orchestrator enforces 1 RPS throttle (simple timestamp check + delay). If a request arrives within 1s of the previous one, it waits. This prevents hitting Odos rate limits when user clicks multiple rows quickly.

### Future Providers

Architecture supports adding more providers (1inch, 0x, KyberSwap) by implementing `PriceImpactProvider` interface. Some require API keys — store in `.env` when added.

## Type Changes

### Asset (shared)

Add `decimals` field — needed to convert USD amount to wei for aggregator requests:

```typescript
interface Asset {
  symbol: string;
  address: string;
  decimals: number;  // NEW
}
```

Morpho GraphQL and Aave contract calls already return decimals — just not saved currently. Fetcher changes needed:
- **Morpho** (`morpho.ts`): add `decimals` to GraphQL query for both `collateralAsset` and `loanAsset`, propagate through `transformMorphoMarket`
- **Aave** (`aave.ts`): extract decimals from reserve data tuples (already available in the response), propagate through `transformAaveReserve`

This changes the `/api/markets` response shape — `Asset` gains a `decimals` field. Additive change (no fields removed).

## API Endpoint

### `GET /api/price-impact`

```
GET /api/price-impact?collateral=0x9d39...&borrow=0xa0b8...&amountUsd=5000&leverage=3.33&protocol=morpho&marketId=0xabc...
```

| Parameter   | Type   | Required | Description                                      |
|-------------|--------|----------|--------------------------------------------------|
| collateral  | string | yes      | Collateral token address                         |
| borrow      | string | yes      | Borrow token address                             |
| amountUsd   | number | yes      | Deposit amount in USD                            |
| leverage    | number | yes      | Leverage multiplier                              |
| protocol    | string | yes      | "morpho" or "aave"                               |
| marketId    | string | no       | Morpho market uniqueKey (required for Morpho)    |

`protocol` + `marketId` identify the exact market row. For Aave, collateral+borrow+protocol is unique. For Morpho, `marketId` is needed because multiple markets can share the same pair with different LTVs.

### Parameter Validation

| Condition                          | HTTP Status | Response                                      |
|------------------------------------|-------------|-----------------------------------------------|
| Missing required params            | 400         | `{ "error": "Missing required parameter: X" }`|
| Invalid address format             | 400         | `{ "error": "Invalid address format: X" }`    |
| amountUsd <= 0 or non-numeric      | 400         | `{ "error": "amountUsd must be positive" }`   |
| leverage < 1                       | 400         | `{ "error": "leverage must be >= 1" }`        |
| Market not found in cache          | 404         | `{ "error": "Market not found" }`             |
| Cache empty (startup, no data yet) | 503         | `{ "error": "Market data not loaded yet" }`   |
| All providers failed               | 502         | `{ "error": "All price providers failed" }`   |

### USD-to-Wei Conversion

Assumes all borrow assets are worth $1 (they are all stablecoins by design). Conversion: `amountUsd × leverage × 10^decimals`. This is intentionally approximate — minor stablecoin depegs (e.g. FRAX at $0.998) produce negligible quote differences for price impact estimation.

### Backend Flow

1. Validate parameters
2. Find market in cache by `protocol` + `collateral` + `borrow` (+ `marketId` for Morpho) → get `borrowAsset.decimals`
3. Calculate `amountUsd × leverage` → convert to borrow token wei
4. Call orchestrator (Odos → Velora, with 1 RPS throttle)
5. Return `PriceImpactResult`

### Response (200)

```json
{
  "provider": "odos",
  "priceImpact": 0.0012,
  "outputAmount": "4985.23",
  "effectivePrice": 1.0234,
  "gasEstimateUsd": 12.5
}
```

`outputAmount` is human-readable with decimals applied (not raw wei). Frontend recalculates entry cost and break-even using real priceImpact via existing `calculator.ts`.

### Error Response

```json
{
  "error": "description of what went wrong"
}
```

## Logging

All logging in the provider orchestrator:

- `info` — every successful request: provider, pair, amount, price impact, response time
- `warn` — fallback to Velora (reason: rate limit / Odos error)
- `error` — both providers failed

Format:
```
[INFO] price-impact: odos | sUSDe/USDT | $16,650 (5000x3.33) | 0.12% | 340ms
[INFO] price-impact: velora | sUSDe/USDT | $16,650 (5000x3.33) | 0.14% | 520ms  (fallback)
[WARN] price-impact: odos rate limited, falling back to velora | sUSDe/USDT
[ERROR] price-impact: all providers failed for sUSDe/USDT | odos: 429 | velora: timeout
```

## Frontend

### FiltersBar

New input field "Сумма входа":
- Static "$" prefix (not editable), user edits only the number
- Default: 5000
- Positioned next to existing fee fields
- Changing the value resets all loaded price impact data (no debounce needed — data is fetched on click, not on input change)

### Column Visibility

Toggle button (gear icon) near the table — opens a checklist of all columns. Visibility state persisted in `localStorage`. All columns visible by default. All columns are toggleable.

### Price Impact Column

New column "Price Impact" in the table (after "Liq. Buffer", before "Leverage"):
- Default state: button icon (📊)
- After click: replaced with value (e.g. "0.12%")
- Loading: spinner
- Error: retry button

### Expandable Row

Clicking the price impact button/value expands the row:

```
┌─────────────────────────────────────────────────────┐
│  Price Impact: 0.12%          Provider: Odos        │
│  Eff. price: 1 sUSDe = 1.0234 USDT                 │
│  Output: 4,985.23 sUSDe                             │
│  Gas: ~$12.50                                       │
│  ─────────────────────────────────────────────────── │
│  Entry Cost (real): 0.22%    vs default: 0.17%      │
│  Break-Even (real): 3.2 days vs default: 2.1 days   │
└─────────────────────────────────────────────────────┘
```

### Behavior

- Data fetched on click only, never automatically
- Changing deposit amount resets all loaded price impact data
- Multiple rows can be expanded simultaneously
- Button is disabled while another request is in-flight for the same row (prevents duplicate requests)

## What We Don't Do

- No caching of price impact results (data is stale within seconds)
- No automatic fetching (only on button click)
- No provider selection in UI (fallback is automatic)
- No batch "check all" mode (1 RPS limit makes it impractical)

## Data Flow

```
User enters $5,000 in FiltersBar
         │
Clicks 📊 on sUSDe/USDT row (leverage 3.33x, Morpho, marketId=0xabc...)
         │
Frontend: GET /api/price-impact?collateral=0x9d39...&borrow=0xdac1...&amountUsd=5000&leverage=3.33&protocol=morpho&marketId=0xabc...
         │
Backend:
  1. Validate params
  2. Find market in cache → borrowAsset.decimals = 6 (USDT)
  3. sellAmount = 5000 × 3.33 = 16,650 USDT → 16650000000 (6 decimals)
  4. Orchestrator checks 1 RPS throttle → waits if needed
  5. Odos POST /sor/quote/v3
     { chainId: 1, inputTokens: [{tokenAddress: "0xdac1...", amount: "16650000000"}],
       outputTokens: [{tokenAddress: "0x9d39...", proportion: 1}] }
  6. Log result, return to client
     (on error → Velora GET /prices → log fallback)
         │
Frontend:
  7. Receives { priceImpact, outputAmount, effectivePrice, gasEstimateUsd, provider }
  8. Substitutes real priceImpact into computeMetrics() instead of default
  9. Shows expandable row with details and comparison
```
