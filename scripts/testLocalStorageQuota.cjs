const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/');

  // Fill localStorage with many entries to provoke quota
  const fillResult = await page.evaluate(() => {
    try {
      for (let i = 0; i < 2000; i++) {
        const k = `big_fill_${i}`;
        // ~1KB per entry
        localStorage.setItem(k, 'x'.repeat(1024));
      }
      return { filled: 2000 };
    } catch (e) {
      return { error: String(e), filledSoFar: 0 };
    }
  });

  // Define safeWriteJSON in the page and try to write a large log array
  const testResult = await page.evaluate(() => {
    function isQuotaError(e) {
      if (!e) return false;
      try {
        if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
          return e.name === 'QuotaExceededError' || e.code === 22;
        }
      } catch (err) {
        // ignore
      }
      if (typeof e === 'object' && e !== null) {
        const m = (e).message;
        return /quota/i.test(String(m || e));
      }
      return /quota/i.test(String(e));
    }

    function safeWriteJSON(key, value, opts) {
      const attempts = (opts && opts.maxAttempts) || 5;
      const minItems = (opts && opts.minItems) || 10;
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { ok: true, written: Array.isArray(value) ? value.length : null };
      } catch (err) {
        if (!isQuotaError(err)) return { ok: false, error: String(err) };
        if (Array.isArray(value)) {
          let items = value.slice();
          for (let i = 0; i < attempts; i++) {
            const keep = Math.max(minItems, Math.floor(items.length / 2));
            items = items.slice(0, keep);
            try {
              localStorage.setItem(key, JSON.stringify(items));
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
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            if (/log|cache|temp|soba|big_fill/i.test(k) && k !== key) keys.push(k);
          }
          for (const k of keys) {
            try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
          }
          localStorage.setItem(key, JSON.stringify(value));
          return { ok: true, written: Array.isArray(value) ? value.length : null, cleanedKeys: keys.length };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
    }

    // Create a large array of 1000 small objects (~maybe >1MB when serialized)
    const big = Array.from({ length: 1000 }, (_, i) => ({ id: i, ts: new Date().toISOString(), payload: 'y'.repeat(512) }));
    return safeWriteJSON('sobaLogs_v2_test', big, { maxAttempts: 6, minItems: 20 });
  });

  const screenshotPath = `./scripts/test-quota-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log('fillResult:', fillResult);
  console.log('testResult:', testResult);
  console.log('screenshot:', screenshotPath);

  // save result to a file for CI inspection
  fs.writeFileSync('./scripts/testLocalStorageQuota-result.json', JSON.stringify({ fillResult, testResult, screenshotPath }, null, 2));

  await browser.close();
  process.exit(testResult && testResult.ok ? 0 : 2);
})();
