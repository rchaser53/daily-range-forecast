require("dotenv").config();

const express = require("express");
const path = require("path");
const { extractStockCode, getDailyBars, clearCache } = require("./lib/jquants");
const { detectLevels, calculateSMA, aggregateBars } = require("./lib/analysis");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/lightweight-charts", express.static(path.join(__dirname, "node_modules/lightweight-charts/dist")));

app.get("/api/chart", async (req, res) => {
  try {
    if (!req.query.url) return res.status(400).json({ error: "url parameter is required" });

    const timeframe = req.query.timeframe || "daily";
    if (!["daily", "weekly", "monthly"].includes(timeframe)) {
      return res.status(400).json({ error: "timeframe must be daily, weekly, or monthly" });
    }

    const code = extractStockCode(req.query.url);
    const dailyBars = await getDailyBars(code);
    if (!dailyBars.length) return res.status(404).json({ error: "株価データがありません" });

    const bars = aggregateBars(dailyBars, timeframe);

    res.json({
      code,
      timeframe,
      bars,
      sma: {
        sma5: calculateSMA(bars, 5),
        sma25: calculateSMA(bars, 25),
        sma75: calculateSMA(bars, 75)
      },
      levels: detectLevels(bars)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/cache", async (req, res) => {
  try {
    if (!req.query.url) return res.status(400).json({ error: "url parameter is required" });

    const code = extractStockCode(req.query.url);
    const deleted = await clearCache(code);
    res.json({ code, deleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`Daily Range Forecast: http://localhost:${port}`));
