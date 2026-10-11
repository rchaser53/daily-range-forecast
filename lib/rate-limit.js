const { performance } = require("node:perf_hooks");

// 13 seconds between starts leaves headroom under Free's 5 requests/minute.
const REQUEST_INTERVAL_MS = 13_000;

function createRequestQueue({
  now = () => performance.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  let queue = Promise.resolve();
  let nextStart = 0;

  return function enqueue(request) {
    const result = queue.then(async () => {
      // Recheck the monotonic clock in case a timer wakes early.
      while (now() < nextStart) await sleep(nextStart - now());
      nextStart = now() + REQUEST_INTERVAL_MS;
      return request();
    });
    // A failed request still consumes a slot, but must not poison the queue.
    queue = result.catch(() => {});
    return result;
  };
}

module.exports = { createRequestQueue, REQUEST_INTERVAL_MS };
