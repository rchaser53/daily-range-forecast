const test = require("node:test");
const assert = require("node:assert/strict");
const { detectPivots, calculateSMA, aggregateBars } = require("../lib/analysis");
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

test("aggregateBars creates weekly OHLCV bars", () => {
  const bars = [
    { date:"2026-01-05", open:100, high:110, low:95, close:105, volume:10 },
    { date:"2026-01-06", open:106, high:112, low:101, close:108, volume:20 },
    { date:"2026-01-09", open:108, high:115, low:107, close:114, volume:30 },
    { date:"2026-01-12", open:115, high:118, low:110, close:111, volume:40 }
  ];

  assert.deepEqual(aggregateBars(bars, "weekly"), [
    { date:"2026-01-09", open:100, high:115, low:95, close:114, volume:60 },
    { date:"2026-01-12", open:115, high:118, low:110, close:111, volume:40 }
  ]);
});

test("aggregateBars creates monthly OHLCV bars", () => {
  const bars = [
    { date:"2026-01-30", open:100, high:110, low:95, close:105, volume:10 },
    { date:"2026-02-02", open:106, high:112, low:101, close:108, volume:20 },
    { date:"2026-02-27", open:108, high:115, low:107, close:114, volume:30 }
  ];

  assert.deepEqual(aggregateBars(bars, "monthly"), [
    { date:"2026-01-30", open:100, high:110, low:95, close:105, volume:10 },
    { date:"2026-02-27", open:106, high:115, low:101, close:114, volume:50 }
  ]);
});
