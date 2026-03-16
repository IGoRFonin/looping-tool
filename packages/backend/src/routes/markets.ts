import { Router } from "express";
import { MarketCache } from "../cache.js";
import { fetchAllMarkets } from "../fetchers/index.js";

export const cache = new MarketCache();
export const marketsRouter = Router();

marketsRouter.get("/markets", (_req, res) => {
  res.json(cache.get());
});

marketsRouter.post("/markets/refresh", async (_req, res) => {
  try {
    const { markets, errors } = await fetchAllMarkets();
    cache.set(markets, errors);
    res.json(cache.get());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
