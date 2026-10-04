const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const path = require("path");
const { clearCache, readCache, writeCache } = require("../lib/jquants");

test("daily bars cache persists by stock code", async () => {
  const code = "99999";
  const bars = [{ date: "2026-01-01", open: 1, high: 2, low: 1, close: 2, volume: 100 }];
  await writeCache(code, bars);
  assert.deepEqual(await readCache(code), bars);
  await fs.rm(path.join(__dirname, "..", ".cache", "daily-bars", `${code}.json`), { force: true });
});

test("clearCache removes only the requested stock code cache", async () => {
  const code = "99998";
  const bars = [{ date: "2026-01-02", open: 2, high: 3, low: 1, close: 2, volume: 200 }];

  await writeCache(code, bars);
  assert.equal(await clearCache(code), true);
  assert.equal(await readCache(code), null);
  assert.equal(await clearCache(code), false);
});
