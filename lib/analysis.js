function detectPivots(bars, left = 3, right = 3) {
  const highs = [];
  const lows = [];

  for (let i = left; i < bars.length - right; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, date: bars[i].date, price: bars[i].high });
    if (isLow) lows.push({ index: i, date: bars[i].date, price: bars[i].low });
  }
  return { highs, lows };
}

function clusterPivots(pivots, tolerance = 0.015) {
  const clusters = [];
  for (const pivot of pivots) {
    const cluster = clusters.find((item) =>
      Math.abs(pivot.price - item.price) / item.price <= tolerance
    );
    if (cluster) {
      cluster.points.push(pivot);
      cluster.price = cluster.points.reduce((sum, p) => sum + p.price, 0) / cluster.points.length;
    } else {
      clusters.push({ price: pivot.price, points: [pivot] });
    }
  }
  return clusters;
}

function detectLevels(bars, options = {}) {
  const { pivotLeft = 3, pivotRight = 3, tolerance = 0.015, minTouches = 2 } = options;
  const { highs, lows } = detectPivots(bars, pivotLeft, pivotRight);
  const convert = (type) => (cluster) => ({
    type,
    price: Math.round(cluster.price * 10) / 10,
    touches: cluster.points.length,
    points: cluster.points
  });

  return {
    resistances: clusterPivots(highs, tolerance).filter((x) => x.points.length >= minTouches).map(convert("resistance")),
    supports: clusterPivots(lows, tolerance).filter((x) => x.points.length >= minTouches).map(convert("support"))
  };
}

function calculateSMA(bars, period) {
  const result = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) result.push({ time: bars[i].date, value: sum / period });
  }
  return result;
}

function periodKey(date, timeframe) {
  const [year, month, day] = date.split("-").map(Number);
  if (timeframe === "monthly") return `${year}-${String(month).padStart(2, "0")}`;

  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - weekday + 1);
  return d.toISOString().slice(0, 10);
}

function aggregateBars(bars, timeframe = "daily") {
  if (timeframe === "daily") return bars.map((bar) => ({ ...bar }));
  if (!["weekly", "monthly"].includes(timeframe)) throw new Error("timeframe must be daily, weekly, or monthly");

  const groups = new Map();
  for (const bar of bars) {
    const key = periodKey(bar.date, timeframe);
    let group = groups.get(key);
    if (!group) {
      group = {
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0
      };
      groups.set(key, group);
      continue;
    }

    group.date = bar.date;
    group.high = Math.max(group.high, bar.high);
    group.low = Math.min(group.low, bar.low);
    group.close = bar.close;
    group.volume += bar.volume ?? 0;
  }

  return Array.from(groups.values());
}

module.exports = { detectPivots, detectLevels, calculateSMA, aggregateBars };
