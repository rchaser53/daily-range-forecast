const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestQueue, REQUEST_INTERVAL_MS } = require("../lib/rate-limit");

function clock() {
  let time = 0;
  const waits = [];
  return {
    waits,
    now: () => time,
    advance: (ms) => { time += ms; },
    sleep: async (ms) => { waits.push(ms); time += ms; }
  };
}

test("concurrent callers start in order and stay below five requests per minute", async () => {
  const timer = clock();
  const enqueue = createRequestQueue(timer);
  const starts = [];
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => enqueue(() => {
    starts.push(timer.now());
    return i;
  })));
  assert.deepEqual(results, Array.from({ length: 12 }, (_, i) => i));
  assert.equal(starts[0], 0);
  for (let i = 1; i < starts.length; i++) {
    assert.equal(starts[i] - starts[i - 1], REQUEST_INTERVAL_MS);
  }
  for (const start of starts) {
    assert.ok(starts.filter((t) => t >= start && t < start + 60_000).length <= 5);
  }
});

test("failed requests consume a slot without blocking later requests", async () => {
  const timer = clock();
  const enqueue = createRequestQueue(timer);
  const failure = enqueue(() => { throw new Error("network failure"); });
  const success = enqueue(() => timer.now());
  await assert.rejects(failure, /network failure/);
  assert.equal(await success, REQUEST_INTERVAL_MS);
});

test("request duration counts toward spacing and idle queues need no extra delay", async () => {
  const timer = clock();
  const enqueue = createRequestQueue(timer);
  await enqueue(async () => { timer.advance(5000); });
  await enqueue(() => {});
  assert.deepEqual(timer.waits, [8000]);
  timer.advance(60_000);
  await enqueue(() => {});
  assert.deepEqual(timer.waits, [8000]);
});

test("early timer wakeups cannot start a request before its slot", async () => {
  let time = 0;
  const enqueue = createRequestQueue({
    now: () => time,
    sleep: async (ms) => { time += Math.min(ms, 1000); }
  });
  await enqueue(() => {});
  assert.equal(await enqueue(() => time), REQUEST_INTERVAL_MS);
});

test("daily bars share the queue across codes and cached reads skip API requests", async () => {
  const vm = require("node:vm");
  const fs = require("node:fs");
  const timer = clock();
  const starts = [];
  const files = new Map();
  const fakeFs = {
    readFile: async (file) => {
      if (!files.has(file)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return files.get(file);
    },
    mkdir: async () => {},
    writeFile: async (file, content) => { files.set(file, content); },
    rename: async (from, to) => { files.set(to, files.get(from)); files.delete(from); }
  };
  const sandbox = {
    module: { exports: {} }, __dirname: "/app/lib", URL,
    process: { env: { JQUANTS_API_KEY: "test-key" }, pid: 1 },
    require: (name) => name === "fs/promises" ? fakeFs
      : name === "./rate-limit" ? { createRequestQueue: () => createRequestQueue(timer) }
      : require(name),
    fetch: async () => {
      starts.push(timer.now());
      return { ok: true, json: async () => ({ data: [
        { Date: "2026-01-01", O: 1, H: 2, L: 1, C: 2, Vo: 100 }
      ] }) };
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../lib/jquants"), "utf8"), sandbox);
  const { getDailyBars } = sandbox.module.exports;
  await Promise.all([getDailyBars("4689"), getDailyBars("7203")]);
  assert.deepEqual(starts, [0, REQUEST_INTERVAL_MS]);
  await getDailyBars("4689");
  assert.equal(starts.length, 2);
  assert.deepEqual(timer.waits, [REQUEST_INTERVAL_MS]);
});
