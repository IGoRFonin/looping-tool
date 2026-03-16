import "dotenv/config";
import express from "express";
import cors from "cors";
import { marketsRouter } from "./routes/markets.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use("/api", marketsRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
