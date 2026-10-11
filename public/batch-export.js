(function (root) {
  function parseConfig(text) {
    const config = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (!config || !Array.isArray(config.codes) || !config.codes.length || config.codes.length > 100) {
      throw new Error('codesに1〜100件の銘柄コードを指定してください');
    }
    const codes = config.codes.map((code) => {
      if (typeof code !== "string" || !/^\d{4,5}$/.test(code)) {
        throw new Error('銘柄コードは4〜5桁の数字の文字列で指定してください');
      }
      return code;
    });
    return [...new Set(codes)];
  }

  async function collectSnapshots(codes, timeframe, capture, progress) {
    const entries = [];
    const errors = [];
    for (const [index, code] of codes.entries()) {
      try {
        entries.push({ name: `${code}-${timeframe}.png`, data: await capture(code) });
      } catch (error) {
        errors.push(`${code}: ${error.message}`);
      }
      progress(index + 1, codes.length, code);
    }
    return { entries, errors };
  }

  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ZIP STORE records: PNG is already compressed; no extra dependency is needed.
  function createZip(entries) {
    const encoder = new TextEncoder();
    const local = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data);
      const header = new Uint8Array(30 + name.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x800, true);
      view.setUint16(12, 33, true); // 1980-01-01
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      header.set(name, 30);
      local.push(header, data);
      const directory = new Uint8Array(46 + name.length);
      const dv = new DataView(directory.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, 0x800, true);
      dv.setUint16(14, 33, true);
      dv.setUint32(16, crc, true);
      dv.setUint32(20, data.length, true);
      dv.setUint32(24, data.length, true);
      dv.setUint16(28, name.length, true);
      dv.setUint32(42, offset, true);
      directory.set(name, 46);
      central.push(directory);
      offset += header.length + data.length;
    }
    const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    const output = new Uint8Array(offset + centralSize + end.length);
    let cursor = 0;
    for (const part of [...local, ...central, end]) {
      output.set(part, cursor);
      cursor += part.length;
    }
    return output;
  }

  const api = { parseConfig, collectSnapshots, createZip };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BatchExport = api;
})(globalThis);
