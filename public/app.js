const { createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle } = LightweightCharts;
let chart;

document.getElementById("load").addEventListener("click", loadChart);
document.getElementById("timeframe").addEventListener("change", loadChart);
document.getElementById("copy-snapshot").addEventListener("click", copySnapshot);

const timeframeLabels = {
  daily: "日次",
  weekly: "週次",
  monthly: "月次"
};

async function loadChart() {
  const status = document.getElementById("status");
  const sourceUrl = document.getElementById("url").value;
  const timeframe = document.getElementById("timeframe").value;
  status.textContent = "読み込み中...";

  try {
    const params = new URLSearchParams({ url: sourceUrl, timeframe });
    const response = await fetch(`/api/chart?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "データ取得に失敗しました");
    status.textContent = `銘柄コード: ${data.code} / ${timeframeLabels[data.timeframe]} / ${data.bars.length}本`;
    renderChart(data);
  } catch (error) {
    status.textContent = `エラー: ${error.message}`;
  }
}

async function copySnapshot() {
  const status = document.getElementById("status");

  if (!chart) {
    status.textContent = "チャートを読み込んでからスナップショットをコピーしてください";
    return;
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    status.textContent = "このブラウザは画像のクリップボードコピーに対応していません";
    return;
  }

  const button = document.getElementById("copy-snapshot");
  button.disabled = true;
  status.textContent = "スナップショットをコピー中...";

  try {
    const canvas = chart.takeScreenshot();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("PNG画像の生成に失敗しました"));
      }, "image/png");
    });

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob })
    ]);

    status.textContent = "チャート画像をクリップボードにコピーしました。ChatGPTへそのまま貼り付けできます";
  } catch (error) {
    status.textContent = `スナップショットのコピーに失敗しました: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function renderChart(data) {
  const container = document.getElementById("chart");
  if (chart) chart.remove();

  chart = createChart(container, {
    autoSize: true,
    layout: { background: { color: "#111" }, textColor: "#ccc" },
    grid: { vertLines: { color: "#222" }, horzLines: { color: "#222" } }
  });

  const candles = chart.addSeries(CandlestickSeries);
  candles.setData(data.bars.map((b) => ({
    time: b.date, open: b.open, high: b.high, low: b.low, close: b.close
  })));

  const volume = chart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: ""
  });
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  volume.setData(data.bars.map((b) => ({
    time: b.date,
    value: b.volume || 0,
    color: b.close >= b.open ? "rgba(38,166,154,.5)" : "rgba(239,83,80,.5)"
  })));

  [["sma5","SMA 5"],["sma25","SMA 25"],["sma75","SMA 75"]].forEach(([key,title]) => {
    const series = chart.addSeries(LineSeries, { lineWidth: 1, title });
    series.setData(data.sma[key]);
  });

  data.levels.resistances.forEach((level) => candles.createPriceLine({
    price: level.price, lineWidth: 2, lineStyle: LineStyle.Dashed,
    axisLabelVisible: true, title: `R ${level.touches}回`
  }));
  data.levels.supports.forEach((level) => candles.createPriceLine({
    price: level.price, lineWidth: 2, lineStyle: LineStyle.Dotted,
    axisLabelVisible: true, title: `S ${level.touches}回`
  }));

  chart.timeScale().fitContent();
}

loadChart();
