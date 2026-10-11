const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("snapshot includes the stock code above the chart", () => {
  const calls = [];
  const chartCanvas = { width: 500, height: 300 };
  const context = {
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args])
  };
  const source = fs.readFileSync(require.resolve("../public/app.js"), "utf8");
  const sandbox = {
    LightweightCharts: { createChart() {}, CandlestickSeries: {}, HistogramSeries: {}, LineSeries: {}, LineStyle: {} },
    document: {
      getElementById: () => ({ addEventListener() {} }),
      createElement: () => ({ getContext: () => context })
    },
    fetch: () => new Promise(() => {})
  };
  vm.runInNewContext(source, sandbox);
  const snapshot = vm.runInNewContext('createSnapshotCanvas({ width: 500, height: 300 }, "4689")', sandbox);
  assert.equal(snapshot.width, 500);
  assert.equal(snapshot.height, 340);
  assert.deepEqual(calls.filter(([method]) => method === "fillText"), [["fillText", "銘柄コード: 4689", 12, 20]]);
  assert.equal(calls.find(([method]) => method === "drawImage")[2], 0);
  assert.equal(calls.find(([method]) => method === "drawImage")[3], 40);
});
