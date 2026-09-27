const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://api.jquants.com/v2";
const CACHE_DIR = path.join(__dirname, "..", ".cache", "daily-bars");

function extractStockCode(kabutanUrl) {
  let url;
  try { url = new URL(kabutanUrl); } catch { throw new Error("有効なURLを指定してください"); }
  if (url.hostname !== "kabutan.jp" && !url.hostname.endsWith(".kabutan.jp")) {
    throw new Error("株探のURLを指定してください");
  }
  const code = url.searchParams.get("code");
  if (!code || !/^\d{4,5}$/.test(code)) throw new Error("URLから有効な証券コードを取得できません");
  return code;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cachePath(code) {
  return path.join(CACHE_DIR, `${code}.json`);
}

async function readCache(code) {
  try {
    const content = await fs.readFile(cachePath(code), "utf8");
    const cached = JSON.parse(content);
    return Array.isArray(cached.bars) ? cached.bars : null;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeCache(code, bars) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const temp = `${cachePath(code)}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ code, fetchedAt: new Date().toISOString(), bars }), "utf8");
  await fs.rename(temp, cachePath(code));
}

async function fetchDailyBars(code) {
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) throw new Error("JQUANTS_API_KEY が設定されていません");

  const url = new URL(`${BASE_URL}/equities/bars/daily`);
  url.searchParams.set("code", code);
  const response = await fetch(url, { headers: { "x-api-key": apiKey } });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`J-Quants API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const rows = json.daily_quotes ?? json.data ?? json.items ?? [];
  return rows.map((row) => ({
    date: row.Date ?? row.date,
    open: numberOrNull(row.Open ?? row.O ?? row.open),
    high: numberOrNull(row.High ?? row.H ?? row.high),
    low: numberOrNull(row.Low ?? row.L ?? row.low),
    close: numberOrNull(row.Close ?? row.C ?? row.close),
    volume: numberOrNull(row.Volume ?? row.Vo ?? row.volume)
  })).filter((bar) =>
    bar.date && bar.open !== null && bar.high !== null && bar.low !== null && bar.close !== null
  ).sort((a, b) => a.date.localeCompare(b.date));
}

async function getDailyBars(code) {
  const cached = await readCache(code);
  if (cached) return cached;

  const bars = await fetchDailyBars(code);
  await writeCache(code, bars);
  return bars;
}

module.exports = { extractStockCode, getDailyBars, readCache, writeCache };
