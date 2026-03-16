// packages/backend/src/index.ts
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";
import { marketsRouter, cache } from "./routes/markets.js";
import { fetchAllMarkets } from "./fetchers/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use("/api", marketsRouter);

// Fetch data on startup
async function init() {
  console.log("Fetching initial market data...");
  const { markets, errors } = await fetchAllMarkets();
  cache.set(markets, errors);
  console.log(`Loaded ${markets.length} markets. Errors: ${errors.length}`);

  // Optional auto-refresh
  const interval = process.env.REFRESH_INTERVAL_MS;
  if (interval) {
    const ms = parseInt(interval, 10);
    if (ms > 0) {
      setInterval(async () => {
        console.log("Auto-refreshing market data...");
        const result = await fetchAllMarkets();
        cache.set(result.markets, result.errors);
        console.log(`Refreshed: ${result.markets.length} markets`);
      }, ms);
    }
  }
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  init().catch(console.error);
});
