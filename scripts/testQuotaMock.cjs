const fs = require('fs');

// Mock localStorage with byte quota
function createMockStorage(maxBytes) {
  const store = new Map();
  let used = 0;
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      const str = String(value);
      const prev = store.get(key);
      const prevLen = prev ? Buffer.byteLength(String(prev), 'utf8') : 0;
      const newLen = Buffer.byteLength(str, 'utf8');
      if (used - prevLen + newLen > maxBytes) {
        const err = new Error('QuotaExceededError: mock');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, str);
      used = used - prevLen + newLen;
    },
    removeItem(key) {
      const prev = store.get(key);
      if (prev) {
        used -= Buffer.byteLength(String(prev), 'utf8');
        store.delete(key);
      }
    },
    key(i) { return Array.from(store.keys())[i]; },
    get length() { return store.size; },
    debug() { return { used, max: maxBytes, keys: Array.from(store.keys()).slice(0,10) }; }
  };
}

// Reimplement safeWriteJSON logic against provided storage
function isQuotaError(e) {
  if (!e) return false;
  if (e && e.name === 'QuotaExceededError') return true;
  return /quota/i.test(String((e && e.message) || e));
}

function safeWriteJSONWithStorage(storage, key, value, opts) {
  const attempts = (opts && opts.maxAttempts) || 5;
  const minItems = (opts && opts.minItems) || 10;
  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true, written: Array.isArray(value) ? value.length : null };
  } catch (err) {
    if (!isQuotaError(err)) return { ok: false, error: String(err) };
    if (Array.isArray(value)) {
      let items = value.slice();
      for (let i = 0; i < attempts; i++) {
        const keep = Math.max(minItems, Math.floor(items.length / 2));
        items = items.slice(0, keep);
        try {
          storage.setItem(key, JSON.stringify(items));
          return { ok: true, written: items.length, trimmed: true };
        } catch (e) {
          if (!isQuotaError(e)) return { ok: false, error: String(e) };
          if (items.length <= minItems) break;
        }
      }
    }
    // cleanup some likely large keys and retry
    try {
      const keys = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i) || '';
        if (/log|cache|temp|soba|big_fill/i.test(k) && k !== key) keys.push(k);
      }
      for (const k of keys) {
        try { storage.removeItem(k); } catch (e) { }
      }
      storage.setItem(key, JSON.stringify(value));
      return { ok: true, written: Array.isArray(value) ? value.length : null, cleanedKeys: keys.length };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

// Run mock test
const storage = createMockStorage(200 * 1024); // 200KB quota

// fill with many ~1KB entries
let filled = 0;
for (let i = 0; i < 500; i++) {
  try {
    storage.setItem('big_fill_' + i, 'x'.repeat(1024));
    filled++;
  } catch (e) {
    break;
  }
}

const big = Array.from({ length: 1000 }, (_, i) => ({ id: i, payload: 'y'.repeat(512) }));
const result = safeWriteJSONWithStorage(storage, 'sobaLogs_v2_test', big, { maxAttempts: 6, minItems: 20 });

const out = { filled, storageDebug: storage.debug(), result };
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync('./scripts/testQuotaMock-result.json', JSON.stringify(out, null, 2));
process.exit(result && result.ok ? 0 : 2);
