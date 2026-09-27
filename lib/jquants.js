const BASE_URL = "https://api.jquants.com/v2";

function extractStockCode(kabutanUrl) {
  let url;
  try {
    url = new URL(kabutanUrl);
  } catch {
    throw new Error("有効なURLを指定してください");
  }

  if (url.hostname !== "kabutan.jp" && !url.hostname.endsWith(".kabutan.jp")) {
    throw new Error("株探のURLを指定してください");
  }

  const code = url.searchParams.get("code");
  if (!code || !/^\d{4,5}$/.test(code)) {
    throw new Error("URLから有効な証券コードを取得できません");
  }
  return code;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getDailyBars(code) {
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
    bar.date && bar.open !== null && bar.high !== null &&
    bar.low !== null && bar.close !== null
  ).sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { extractStockCode, getDailyBars };
