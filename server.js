require("dotenv").config();

const express = require("express");
const path = require("path");
const { extractStockCode, getDailyBars } = require("./lib/jquants");
const { detectLevels, calculateSMA } = require("./lib/analysis");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/lightweight-charts", express.static(path.join(__dirname, "node_modules/lightweight-charts/dist")));

app.get("/api/chart", async (req, res) => {
  try {
    if (!req.query.url) return res.status(400).json({ error: "url parameter is required" });

    const code = extractStockCode(req.query.url);
    const bars = await getDailyBars(code);
    if (!bars.length) return res.status(404).json({ error: "株価データがありません" });

    res.json({
      code,
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

app.listen(port, () => console.log(`Daily Range Forecast: http://localhost:${port}`));
