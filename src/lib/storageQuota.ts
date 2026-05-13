function isQuotaError(e: unknown) {
  if (!e) return false;
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.code === 22;
  }
  if (typeof e === 'object' && e !== null) {
    const m = (e as { message?: unknown }).message;
    return /quota/i.test(String(m || e));
  }
  return /quota/i.test(String(e));
}

/** Güvenli JSON okuma */
export function safeReadJSON<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Return list of keys with approximate byte sizes (descending) */
export function listKeysBySize(limit = 50): Array<{ key: string; size: number }> {
  const out: Array<{ key: string; size: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      try {
        const v = localStorage.getItem(k) || '';
        const size = new Blob([v]).size;
        out.push({ key: k, size });
      } catch {
        out.push({ key: k, size: 0 });
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.size - a.size).slice(0, limit);
}

/**
 * Güvenli JSON yazma. Eğer QuotaExceeded hatası alınırsa ve değer bir dizi ise
 * diziyi kademeli olarak kırparak tekrar denemeye çalışır.
 */
export function safeWriteJSON(key: string, value: unknown, opts?: { maxAttempts?: number; minItems?: number }): boolean {
  const attempts = opts?.maxAttempts ?? 5;
  const minItems = opts?.minItems ?? 10;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (!isQuotaError(err)) return false;

    // Eğer dizi ise kademeli kırpma uygula
    if (Array.isArray(value)) {
      let items: unknown[] = value as unknown[];
      for (let i = 0; i < attempts; i++) {
        const keep = Math.max(minItems, Math.floor(items.length / 2));
        items = items.slice(0, keep);
        try {
          localStorage.setItem(key, JSON.stringify(items));
          return true;
        } catch (e) {
          if (!isQuotaError(e)) return false;
          if (items.length <= minItems) break;
          // devam et, yeniden kırp
        }
      }
    }

    // Son çare: localStorage'dan potansiyel büyük anahtarları temizlemeyi dene
    try {
      // 1) Tespit: en büyük anahtarları önce sil
      const sizes: Array<{ key: string; size: number }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        try {
          const v = localStorage.getItem(k) || '';
          sizes.push({ key: k, size: new Blob([v]).size });
        } catch {
          sizes.push({ key: k, size: 0 });
        }
      }
      sizes.sort((a, b) => b.size - a.size);
      // Öncelikli temizleme: büyük ve eşleşen anahtarlar
      const candidates = sizes.filter(s => /log|cache|temp|soba|big_fill/i.test(s.key) && s.key !== key);
      let cleaned = 0;
      for (const c of candidates) {
        try { localStorage.removeItem(c.key); cleaned++; } catch (err) { void err; /* ignore cleanup error */ }
        // küçük bir gecikme / kontrol yapılabilir
      }
      // Eğer hala quota varsa, silme kapsamını genişlet
      if (cleaned === 0) {
        for (const s of sizes.slice(0, 20)) {
          if (s.key === key) continue;
          try { localStorage.removeItem(s.key); cleaned++; } catch (err) { void err; }
          if (cleaned >= 10) break;
        }
      }
      // tekrar dene bir kez
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (finalErr) {
        void finalErr;
        // Son çare: çok büyük veriyi tamamen yazamıyorsak, minimal bir sentinel
        // yazarak anahtarın var olduğunu ve verinin kırpıldığını belirt.
        try {
          const sentinel = { __truncated__: true, ts: new Date().toISOString(), originalLength: Array.isArray(value) ? (value as unknown[]).length : undefined };
          localStorage.setItem(key, JSON.stringify(sentinel));
          return true;
        } catch (e) {
          void e;
          return false;
        }
      }
    } catch {
      return false;
    }
  }
}

export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
