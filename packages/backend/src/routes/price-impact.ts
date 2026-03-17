import { Router } from "express";
import { cache } from "./markets.js";
import { PriceImpactOrchestrator } from "../fetchers/price-impact/index.js";

const orchestrator = new PriceImpactOrchestrator();
export const priceImpactRouter = Router();

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

priceImpactRouter.get("/price-impact", async (req, res) => {
  try {
    const { collateral, borrow, amountUsd, leverage, protocol, marketId } = req.query;

    for (const [name, value] of [
      ["collateral", collateral],
      ["borrow", borrow],
      ["amountUsd", amountUsd],
      ["leverage", leverage],
      ["protocol", protocol],
    ] as const) {
      if (!value) {
        res.status(400).json({ error: `Missing required parameter: ${name}` });
        return;
      }
    }

    if (!ETH_ADDRESS_RE.test(collateral as string)) {
      res.status(400).json({ error: `Invalid address format: collateral` });
      return;
    }
    if (!ETH_ADDRESS_RE.test(borrow as string)) {
      res.status(400).json({ error: `Invalid address format: borrow` });
      return;
    }

    const amountNum = Number(amountUsd);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: "amountUsd must be positive" });
      return;
    }

    const leverageNum = Number(leverage);
    if (isNaN(leverageNum) || leverageNum < 1) {
      res.status(400).json({ error: "leverage must be >= 1" });
      return;
    }

    const cached = cache.get();
    if (cached.markets.length === 0) {
      res.status(503).json({ error: "Market data not loaded yet" });
      return;
    }

    const collateralLower = (collateral as string).toLowerCase();
    const borrowLower = (borrow as string).toLowerCase();
    const protocolStr = protocol as string;

    const market = cached.markets.find((m) => {
      if (m.protocol !== protocolStr) return false;
      if (m.collateralAsset.address.toLowerCase() !== collateralLower) return false;
      if (m.borrowAsset.address.toLowerCase() !== borrowLower) return false;
      if (protocolStr === "morpho" && marketId && m.marketId !== marketId) return false;
      return true;
    });

    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const totalUsd = amountNum * leverageNum;
    const decimals = market.borrowAsset.decimals;
    const sellAmountWei = BigInt(Math.round(totalUsd)) * BigInt(10 ** decimals);

    const result = await orchestrator.getQuote({
      sellToken: market.borrowAsset.address,
      buyToken: market.collateralAsset.address,
      sellAmountWei: sellAmountWei.toString(),
      chainId: 1,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("All price impact providers failed")) {
      res.status(502).json({ error: message });
    } else {
      console.error("[ERROR] price-impact route:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});
