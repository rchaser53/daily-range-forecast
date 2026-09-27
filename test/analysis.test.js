const test = require("node:test");
const assert = require("node:assert/strict");
const { detectPivots, calculateSMA } = require("../lib/analysis");
const { extractStockCode } = require("../lib/jquants");

test("extractStockCode extracts code from Kabutan URL", () => {
  assert.equal(extractStockCode("https://kabutan.jp/stock/kabuka?code=4689&ashi=day"), "4689");
});

test("extractStockCode rejects other hosts", () => {
  assert.throws(() => extractStockCode("https://example.com/?code=4689"));
});

test("calculateSMA calculates moving average", () => {
  const bars = [1,2,3,4].map((close, i) => ({ date: `2026-01-0${i+1}`, close }));
  assert.deepEqual(calculateSMA(bars, 3), [
    { time: "2026-01-03", value: 2 },
    { time: "2026-01-04", value: 3 }
  ]);
});

test("detectPivots finds a local high and low", () => {
  const bars = [
    {date:"1",high:2,low:1},{date:"2",high:5,low:2},{date:"3",high:3,low:0},
    {date:"4",high:4,low:2},{date:"5",high:2,low:1}
  ];
  const result = detectPivots(bars, 1, 1);
  assert.equal(result.highs[0].price, 5);
  assert.equal(result.lows[0].price, 0);
});
