const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { parseConfig, collectSnapshots, createZip } = require('../public/batch-export');

test('config preserves codes, removes duplicates, accepts BOM and rejects invalid input', () => {
  assert.deepEqual(parseConfig('\uFEFF{"codes":["0123","4689","4689","12345"]}'), ['0123', '4689', '12345']);
  for (const config of [null, {}, { codes: [] }, { codes: [4689] }, { codes: ['../x'] }, { codes: ['123'] }, { codes: Array(101).fill('4689') }]) {
    assert.throws(() => parseConfig(JSON.stringify(config)));
  }
  assert.throws(() => parseConfig('not json'));
});

test('batch captures sequentially, reports progress, and continues after failures', async () => {
  let active = 0;
  const progress = [];
  const result = await collectSnapshots(['4689', '7203', '6758'], 'weekly', async (code) => {
    assert.equal(active++, 0);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (code === '7203') throw new Error('no data');
    return new Uint8Array([1, 2, 3]);
  }, (...args) => progress.push(args));
  assert.deepEqual(result.entries.map(e => e.name), ['4689-weekly.png', '6758-weekly.png']);
  assert.deepEqual(result.errors, ['7203: no data']);
  assert.deepEqual(progress, [[1, 3, '4689'], [2, 3, '7203'], [3, 3, '6758']]);
});

test('ZIP can be read by an independent implementation with intact contents and CRCs', () => {
  const entries = [
    { name: '4689-daily.png', data: new Uint8Array([137, 80, 78, 71, 0, 255]) },
    { name: 'errors.txt', data: new TextEncoder().encode('7203: 株価データがありません') }
  ];
  const result = spawnSync('python3', ['-c', `
import sys, io, zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 assert z.testzip() is None
 assert z.namelist() == ['4689-daily.png', 'errors.txt']
 assert z.read('4689-daily.png') == bytes([137,80,78,71,0,255])
 assert z.read('errors.txt').decode() == '7203: 株価データがありません'
`], { input: createZip(entries), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('UI export renders each chart before capturing and releases charts and download URL', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const events = [];
  const elements = new Map();
  for (const id of ['load', 'timeframe', 'clear-cache', 'copy-snapshot', 'batch-export', 'batch-config', 'batch-status', 'status', 'url']) {
    elements.set(id, { addEventListener() {}, value: id === 'timeframe' ? 'monthly' : '', disabled: false });
  }
  elements.get('batch-config').files = [{ size: 40, text: async () => '{"codes":["4689","7203"]}' }];
  const sandbox = {
    BatchExport: { parseConfig, collectSnapshots, createZip },
    LightweightCharts: {
      createChart() {
        events.push('create');
        return {
          addSeries: () => ({ setData() {}, priceScale: () => ({ applyOptions() {} }), createPriceLine() {} }),
          timeScale: () => ({ fitContent() {} }),
          takeScreenshot: () => { events.push('capture'); return { width: 1200, height: 700 }; },
          remove: () => events.push('remove')
        };
      }, CandlestickSeries: {}, HistogramSeries: {}, LineSeries: {}, LineStyle: {}
    },
    document: {
      getElementById: id => elements.get(id),
      body: { appendChild() {} },
      createElement: tag => tag === 'canvas' ? {
        getContext: () => ({ fillRect() {}, fillText: text => events.push(text), drawImage() {} }),
        toBlob: callback => callback(new Blob(['png']))
      } : { style: {}, click: () => events.push('download'), remove() {} }
    },
    URLSearchParams, TextEncoder, Uint8Array, Blob, AbortSignal,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => events.push('revoke') },
    setTimeout: callback => callback(),
    requestAnimationFrame: callback => { events.push('frame'); callback(); },
    fetch: async url => {
      if (url.includes('url=&')) return new Promise(() => {}); // initial single chart load
      const code = new URL(new URLSearchParams(url.split('?')[1]).get('url')).searchParams.get('code');
      return { ok: true, json: async () => ({ code, timeframe: 'monthly', bars: [], sma: { sma5: [], sma25: [], sma75: [] }, levels: { resistances: [], supports: [] } }) };
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/app.js'), 'utf8'), sandbox);
  await sandbox.exportSnapshots();
  assert.deepEqual(events, [
    'create', 'frame', 'frame', 'capture', '銘柄コード: 4689', 'remove',
    'create', 'frame', 'frame', 'capture', '銘柄コード: 7203', 'remove', 'download', 'revoke'
  ]);
  assert.equal(elements.get('batch-export').disabled, false);
  assert.match(elements.get('batch-status').textContent, /成功: 2件 \/ 失敗: 0件/);
});
