const { createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle } = LightweightCharts;
let chart;

document.getElementById("load").addEventListener("click", loadChart);

async function loadChart() {
  const status = document.getElementById("status");
  const sourceUrl = document.getElementById("url").value;
  status.textContent = "読み込み中...";

  try {
    const response = await fetch(`/api/chart?url=${encodeURIComponent(sourceUrl)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "データ取得に失敗しました");
    status.textContent = `銘柄コード: ${data.code} / ${data.bars.length}日`;
    renderChart(data);
  } catch (error) {
    status.textContent = `エラー: ${error.message}`;
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
