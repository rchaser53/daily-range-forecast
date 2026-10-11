const { createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle } = LightweightCharts;
let chart;
let chartCode;

document.getElementById("load").addEventListener("click", loadChart);
document.getElementById("timeframe").addEventListener("change", loadChart);
document.getElementById("clear-cache").addEventListener("click", clearCacheAndReload);
document.getElementById("copy-snapshot").addEventListener("click", copySnapshot);
document.getElementById("batch-export").addEventListener("click", exportSnapshots);

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

async function clearCacheAndReload() {
  const status = document.getElementById("status");
  const sourceUrl = document.getElementById("url").value;
  const button = document.getElementById("clear-cache");

  button.disabled = true;
  status.textContent = "キャッシュを削除中...";

  try {
    const params = new URLSearchParams({ url: sourceUrl });
    const response = await fetch(`/api/cache?${params}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "キャッシュ削除に失敗しました");

    status.textContent = data.deleted
      ? `銘柄コード ${data.code} のキャッシュを削除しました。最新データを再取得します...`
      : `銘柄コード ${data.code} のキャッシュはありません。最新データを取得します...`;

    await loadChart();
  } catch (error) {
    status.textContent = `エラー: ${error.message}`;
  } finally {
    button.disabled = false;
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
    const canvas = createSnapshotCanvas(chart.takeScreenshot(), chartCode);
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

function createSnapshotCanvas(chartCanvas, code) {
  const padding = 12;
  const headerHeight = 40;
  const canvas = document.createElement("canvas");
  canvas.width = chartCanvas.width;
  canvas.height = chartCanvas.height + headerHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("スナップショットの描画に失敗しました");
  context.fillStyle = "#111";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#eee";
  context.font = "bold 18px system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(`銘柄コード: ${code}`, padding, headerHeight / 2);
  context.drawImage(chartCanvas, 0, headerHeight);
  return canvas;
}

function renderChart(data) {
  chartCode = undefined;
  const container = document.getElementById("chart");
  if (chart) chart.remove();

  chart = buildChart(container, data, { autoSize: true });
  chartCode = data.code;
}

function buildChart(container, data, sizing) {
  const chart = createChart(container, {
    ...sizing,
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
  return chart;
}

async function exportSnapshots() {
  const button = document.getElementById("batch-export");
  if (button.disabled) return;
  const status = document.getElementById("batch-status");
  const file = document.getElementById("batch-config").files[0];
  const timeframe = document.getElementById("timeframe").value;
  if (!file) {
    status.textContent = "銘柄コードのJSON設定ファイルを選択してください";
    return;
  }
  button.disabled = true;
  let container;
  try {
    if (file.size > 1024 * 1024) throw new Error("設定ファイルは1MB以下にしてください");
    const codes = BatchExport.parseConfig(await file.text());
    container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:700px";
    document.body.appendChild(container);
    const result = await BatchExport.collectSnapshots(codes, timeframe, async (code) => {
      status.textContent = `銘柄コード: ${code} を取得中（API制限のため待機する場合があります）`;
      const url = `https://kabutan.jp/stock/kabuka?code=${code}`;
      const response = await fetch(`/api/chart?${new URLSearchParams({ url, timeframe })}`, {
        signal: AbortSignal.timeout(60000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "データ取得に失敗しました");
      let batchChart;
      try {
        batchChart = buildChart(container, data, { width: 1200, height: 700 });
        // Allow the chart's scheduled canvas paint to finish before capturing it.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const canvas = createSnapshotCanvas(batchChart.takeScreenshot(), data.code);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error("PNG画像の生成に失敗しました")), "image/png"
        ));
        return new Uint8Array(await blob.arrayBuffer());
      } finally {
        batchChart?.remove();
      }
    }, (done, total, code) => {
      status.textContent = `${done} / ${total} 件処理済み（銘柄コード: ${code}）`;
    });
    if (!result.entries.length) throw new Error(`全銘柄の取得に失敗しました: ${result.errors.join(" / ")}`);
    if (result.errors.length) result.entries.push({
      name: "errors.txt", data: new TextEncoder().encode(result.errors.join("\n"))
    });
    const blob = new Blob([BatchExport.createZip(result.entries)], { type: "application/zip" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `charts-${timeframe}-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    try { link.click(); } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    }
    status.textContent = `ZIPを保存しました。成功: ${codes.length - result.errors.length}件 / 失敗: ${result.errors.length}件`;
  } catch (error) {
    status.textContent = `一括保存に失敗しました: ${error.message}`;
  } finally {
    container?.remove();
    button.disabled = false;
  }
}

loadChart();
