# Tasarım Belgesi: Test Altyapısı Entegrasyonu

## Genel Bakış

Bu belge, PARSPEL uygulamasına Vitest + fast-check + @testing-library/react + Playwright test altyapısının entegrasyonunu tanımlar. Hedef; mevcut `src/lib/*.test.ts` test dosyalarının çalışır hale getirilmesi, property-based testlerin (PBT) fast-check ile desteklenmesi ve Playwright e2e test altyapısının kurulmasıdır.

Mevcut durumda workspace'de temel Vitest konfigürasyonu (`vite.config.ts`) ve test dosyaları mevcuttur. Bu entegrasyon; eksik konfigürasyonları tamamlar, test organizasyonunu standartlaştırır ve CI/CD uyumlu raporlama altyapısını kurar.

### Araç Seçimi Gerekçesi

| Araç | Versiyon | Gerekçe |
|------|----------|---------|
| **Vitest** | ^4.1.3 | Vite tabanlı proje ile native entegrasyon, Jest uyumlu API |
| **fast-check** | ^3.22.0 | TypeScript-first PBT kütüphanesi, shrinking desteği |
| **@testing-library/react** | ^16.3.2 | React 19 uyumlu, kullanıcı odaklı test yaklaşımı |
| **@testing-library/jest-dom** | ^6.9.1 | DOM assertion'ları için Vitest uyumlu matchers |
| **Playwright** | ^1.59.1 | Chromium tabanlı e2e, güçlü selector API |
| **jsdom** | ^29.0.2 | Tarayıcı ortamı simülasyonu (Vitest environment) |

---

## Mimari

### Test Katmanları

```
┌─────────────────────────────────────────────────────────┐
│                    E2E Testler                           │
│              Playwright + Chromium                       │
│              e2e/*.spec.ts                               │
├─────────────────────────────────────────────────────────┤
│              Entegrasyon Testleri                        │
│         @testing-library/react + jsdom                   │
│         src/components/**/*.test.tsx                     │
├─────────────────────────────────────────────────────────┤
│         Birim + Property-Based Testler                   │
│              Vitest + fast-check                         │
│              src/lib/*.test.ts                           │
└─────────────────────────────────────────────────────────┘
```

### Konfigürasyon Akışı

```
vite.config.ts
  └── test.environment: 'jsdom'
  └── test.globals: true
  └── test.setupFiles: ['./src/test/setup.ts']
  └── test.exclude: [e2e/**, dist/**, node_modules/**, boş dosyalar]

src/test/setup.ts
  └── import '@testing-library/jest-dom'

playwright.config.ts
  └── testDir: './e2e'
  └── projects: [chromium]
  └── baseURL: 'http://localhost:3000'
  └── webServer: { command: 'npm run dev', url: 'http://localhost:3000' }
```

### Test Çalıştırma Akışı

```
npm run test:run
  └── Vitest --run
      └── src/lib/ruleEngine.test.ts        (birim + PBT)
      └── src/lib/auditEngine.test.ts       (birim + PBT)
      └── src/lib/dataIntegrityChecker.test.ts (birim + PBT)
      └── src/lib/similarity.test.ts        (birim + PBT)
      └── src/lib/utils-tr.test.ts          (birim + PBT)
      └── src/lib/kapsamli-senaryo.test.ts  (senaryo)
      └── src/lib/soba-satis-senaryosu.test.ts (senaryo)

npm run test:e2e
  └── Playwright
      └── e2e/example.spec.ts
```

---

## Bileşenler ve Arayüzler

### 1. Vitest Konfigürasyonu (`vite.config.ts`)

Mevcut `vite.config.ts` dosyasındaki `test` bloğu aşağıdaki yapıyı içermelidir:

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    'scripts/**',
    '**/e2e/**',
    '**/gercekci-senaryolar.test.ts',
    '**/uygulama-gercek.test.ts',
    'vy/**',
  ],
}
```

**Mevcut durum:** `vite.config.ts` bu konfigürasyonu zaten içermektedir. Değişiklik gerekmez.

### 2. Test Kurulum Dosyası (`src/test/setup.ts`)

```typescript
// Vitest global test setup
import '@testing-library/jest-dom';
```

**Mevcut durum:** Dosya mevcut ve doğru içeriğe sahip. Değişiklik gerekmez.

### 3. Playwright Konfigürasyonu (`playwright.config.ts`)

Mevcut `playwright.config.ts` dosyasında `baseURL` değeri `http://localhost:5173` olarak ayarlanmıştır. Gereksinim 11.3'e göre bu değer `http://localhost:3000` olmalıdır (projenin `vite.config.ts` içindeki `server.port: 3000` değeriyle uyumlu).

```typescript
use: {
  baseURL: 'http://localhost:3000',  // 5173 → 3000
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
},
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',      // 5173 → 3000
  reuseExistingServer: !process.env.CI,
},
```

### 4. Test Dosyası Yapısı

```
src/
  lib/
    ruleEngine.ts              ← kaynak
    ruleEngine.test.ts         ← birim + PBT (MEVCUT)
    auditEngine.ts             ← kaynak
    auditEngine.test.ts        ← birim + PBT (MEVCUT)
    dataIntegrityChecker.ts    ← kaynak
    dataIntegrityChecker.test.ts ← birim + PBT (MEVCUT)
    similarity.ts              ← kaynak
    similarity.test.ts         ← birim + PBT (OLUŞTURULACAK)
    utils-tr.ts                ← kaynak
    utils-tr.test.ts           ← birim + PBT (MEVCUT)
    kapsamli-senaryo.test.ts   ← senaryo testleri (MEVCUT)
    soba-satis-senaryosu.test.ts ← senaryo testleri (MEVCUT)
    gercekci-senaryolar.test.ts ← EXCLUDE (boş)
    uygulama-gercek.test.ts    ← EXCLUDE (boş)
  test/
    setup.ts                   ← global kurulum (MEVCUT)
e2e/
  example.spec.ts              ← e2e testler (MEVCUT)
```

### 5. npm Script Arayüzü

| Script | Komut | Açıklama |
|--------|-------|---------|
| `test` | `vitest` | Watch modu |
| `test:run` | `vitest --run` | Tek seferlik çalıştırma |
| `test:report` | `vitest run --reporter=html --outputFile=./test-report/index.html` | HTML raporu |
| `test:report:open` | `npx vite preview --outDir test-report --port 4174` | Raporu aç |
| `test:e2e` | `playwright test` | E2E testler |
| `test:e2e:ui` | `playwright test --ui` | E2E UI modu |
| `test:e2e:report` | `playwright show-report` | E2E raporu |

**Mevcut durum:** Tüm scriptler `package.json`'da mevcuttur. Değişiklik gerekmez.

---

## Veri Modelleri

### Test Yardımcı Fabrikaları

Test dosyalarında kullanılan fabrika fonksiyonları tutarlı test verisi üretir:

```typescript
// Minimal geçerli DB nesnesi
function makeDB(overrides: Partial<DB> = {}): DB

// Minimal geçerli Product nesnesi
function makeProduct(overrides: Partial<Product> = {}): Product

// Minimal geçerli KasaEntry nesnesi
function makeKasaEntry(overrides: Partial<KasaEntry> = {}): KasaEntry

// Minimal geçerli Sale nesnesi
function makeSale(overrides: Partial<Sale> = {}): Sale
```

### fast-check Arbitrary Tanımları

PBT testlerinde kullanılan arbitrary üreticiler:

```typescript
// Rastgele geçerli DB nesnesi
const arbDB = () => fc.record({ ... }).map(partial => makeDB(partial))

// En az bir negatif stoklu ürün içeren DB
const arbDBWithNegativeStock = () => fc.record({ ... }).map(...)

// Negatif bakiyeye düşecek kasa içeren DB
const arbDBWithNegativeKasa = () => fc.record({ ... }).map(...)

// Rastgele string çifti (benzerlik testleri için)
const arbStringPair = () => fc.tuple(fc.string(), fc.string())

// Rastgele UTC tarih nesnesi (utils-tr testleri için)
const arbUTCDate = () => fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
```

### Bağımlılık Matrisi

```
package.json devDependencies:
  vitest: ^4.1.3          ✓ MEVCUT
  @vitest/ui: ^4.1.3      ✓ MEVCUT
  fast-check: ^3.22.0     ✓ MEVCUT
  @testing-library/react: ^16.3.2  ✓ MEVCUT
  @testing-library/jest-dom: ^6.9.1 ✓ MEVCUT
  jsdom: ^29.0.2          ✓ MEVCUT
  @playwright/test: ^1.59.1 ✓ MEVCUT
```

---

## Doğruluk Özellikleri (Correctness Properties)

*Bir özellik (property), bir sistemin tüm geçerli çalışmalarında doğru olması gereken bir karakteristik veya davranıştır — temelde sistemin ne yapması gerektiğine dair biçimsel bir ifadedir. Özellikler, insan tarafından okunabilir spesifikasyonlar ile makine tarafından doğrulanabilir doğruluk garantileri arasındaki köprüyü oluşturur.*

### Property 1: validateTransaction Hiçbir Zaman Exception Fırlatmaz

*Herhangi bir* geçerli `prevDB` ve `nextDB` çifti için, `validateTransaction(prevDB, nextDB)` çağrısı exception fırlatmadan her zaman geçerli bir `RuleViolation[]` döndürmelidir; her elemanın `ruleId`, `ruleName`, `message` string alanları ve `'block' | 'warn'` severity değeri bulunmalıdır.

**Validates: Requirements 3.6, 3.8**

---

### Property 2: Negatif Stok Her Zaman Block İhlali Üretir

*Herhangi bir* `nextDB` nesnesi için, en az bir aktif (`deleted: false`) ürünün `stock` değeri negatifse, `validateTransaction(prevDB, nextDB)` çağrısı `ruleId: 'negative_stock'` ve `severity: 'block'` içeren en az bir ihlal döndürmelidir.

**Validates: Requirements 3.1, 3.9**

---

### Property 3: Negatif Kasa Bakiyesi Her Zaman Block İhlali Üretir

*Herhangi bir* kasa konfigürasyonu için, kasa girişlerinin toplamı negatif bakiye üretiyorsa, `validateTransaction(prevDB, nextDB)` çağrısı `ruleId: 'negative_kasa'` ve `severity: 'block'` içeren en az bir ihlal döndürmelidir.

**Validates: Requirements 3.2, 3.10**

---

### Property 4: Sıfır veya Negatif Tutar Her Zaman Block İhlali Üretir

*Herhangi bir* `amount <= 0` değerine sahip yeni `KasaEntry` veya `total <= 0` değerine sahip yeni `Sale` için, `validateTransaction(prevDB, nextDB)` çağrısı `ruleId: 'zero_amount'` ve `severity: 'block'` içeren en az bir ihlal döndürmelidir.

**Validates: Requirements 3.4, 3.5, 3.11**

---

### Property 5: Aynı DB İçin Diff Boştur

*Herhangi bir* geçerli `DB` nesnesi `db` için, `computeDiff(db, db)` çağrısı boş `prevValue` ve `nextValue` nesneleri döndürmelidir; `_auditLog` alanı hiçbir zaman diff sonucuna dahil edilmemelidir.

**Validates: Requirements 4.7, 4.2**

---

### Property 6: trimAuditLog Uzunluk İnvariantı

*Herhangi bir* `AuditEntry[]` dizisi için, `trimAuditLog` uygulandıktan sonra dizi uzunluğu 500'ü aşmamalıdır; 500 veya daha az kayıt içeren diziler değiştirilmeden döndürülmelidir.

**Validates: Requirements 4.4, 4.5, 4.8**

---

### Property 7: getHealthScore Aralık İnvariantı

*Herhangi bir* geçerli `DB` nesnesi için, `getHealthScore(db)` çağrısı 0 ile 100 arasında (dahil) bir tam sayı döndürmelidir; `runIntegrityCheck(db)` çağrısı exception fırlatmadan her zaman `IntegrityIssue[]` döndürmelidir.

**Validates: Requirements 5.4, 5.6, 5.7**

---

### Property 8: Benzerlik Skoru Aralık ve Simetri İnvariantları

*Herhangi bir* string çifti `(a, b)` için:
- `similarity(a, b)` sonucu 0 ile 100 arasında (dahil) olmalıdır
- `similarity(a, b) === similarity(b, a)` (simetri)
- `similarity(s, s) === 100` (self-similarity)

**Validates: Requirements 6.5, 6.6, 6.7**

---

### Property 9: Tarih Round-Trip

*Herhangi bir* geçerli UTC tarih nesnesi `d` için, `parseBankDate(formatBankDate(d))` çağrısı orijinal `d` ile aynı UTC timestamp'e sahip bir `Date` nesnesi döndürmelidir.

**Validates: Requirements 7.4**

---

### Property 10: Markup ≥ Margin Metamorphic Özelliği

*Herhangi bir* `price > cost > 0` koşulunu sağlayan değer çifti için, `calcMarkup(price, cost) >= calcMargin(price, cost)` koşulu her zaman sağlanmalıdır.

**Validates: Requirements 7.7**

---

### Property 11: Stok Sınırı İçinde Satış İhlal Üretmez

*Herhangi bir* başlangıç stok miktarı `n > 0` ve `k <= n` adet ardışık satış için, hiçbir satışta `negative_stock` ihlali üretilmemelidir.

**Validates: Requirements 8.5**

---

### Property 12: Sipariş Tamamlama Idempotency

*Herhangi bir* sipariş için, `stockCompleted: true` olarak işaretlenmiş bir siparişi tekrar `tamamlandi` durumuna geçirmek ürün stoğunu değiştirmemelidir.

**Validates: Requirements 8.4**

---

## Hata Yönetimi

### Kural Motoru Hata Yönetimi

`validateTransaction` fonksiyonu iki katmanlı hata koruması içerir:

1. **Kural düzeyinde:** Her kural kendi `try/catch` bloğuna sahiptir. Bir kural exception fırlatırsa, diğer kurallar değerlendirilmeye devam eder.
2. **Fonksiyon düzeyinde:** Tüm fonksiyon `try/catch` ile sarılıdır. Beklenmedik hata durumunda boş dizi döner (fail-open).

### Audit Engine Hata Yönetimi

`computeDiff` fonksiyonu exception durumunda boş `{ prevValue: {}, nextValue: {} }` döndürür. `detectAnomalies` fonksiyonu 100ms timeout korumalıdır; aşılırsa boş dizi döner.

### Test Ortamı Hata Yönetimi

- `jsdom` ortamında `window.crypto` ve `sessionStorage` mock'lanmalıdır
- `genId()` fonksiyonu `window.crypto.randomUUID` kullanır; test ortamında Vitest'in jsdom konfigürasyonu bunu sağlar
- Playwright testleri dev server'ın çalışır olmasını gerektirir; `webServer` konfigürasyonu bunu otomatik yönetir

### Playwright Kurulum Hatası

Chromium kurulu değilse:
```bash
npx playwright install chromium
```

---

## Test Stratejisi

### Çift Katmanlı Test Yaklaşımı

Bu özellik hem birim/PBT testleri hem de e2e testleri içerir:

- **Birim testleri:** Belirli örnekler, edge case'ler ve hata koşulları
- **Property testleri:** Evrensel özellikler — tüm girdiler için geçerli invariantlar
- **E2E testleri:** Gerçek tarayıcı ortamında uygulama akışları

### Property-Based Testing Konfigürasyonu

**Kütüphane:** fast-check ^3.22.0

Her property testi minimum **100 iterasyon** çalıştırılmalıdır:

```typescript
fc.assert(
  fc.property(arbitrary, (input) => {
    // test mantığı
  }),
  { numRuns: 100 }
);
```

**Test etiketi formatı:**
```typescript
// Feature: test-altyapisi-entegrasyonu, Property {N}: {property_text}
```

### Modül Bazlı Test Kapsamı

#### `ruleEngine.test.ts` (MEVCUT — tamamlanmış)
- Birim: 4 kural × 3-5 senaryo = ~16 test
- PBT: Property 1-4 → 4 property testi × 100 iterasyon

#### `auditEngine.test.ts` (MEVCUT — tamamlanmış)
- Birim: `computeDiff`, `createAuditEntry`, `trimAuditLog`, `runFullAudit`
- PBT: Property 5-6 → 2 property testi × 100 iterasyon

#### `dataIntegrityChecker.test.ts` (MEVCUT — tamamlanmış)
- Birim: `runIntegrityCheck`, `getHealthScore`, `detectAnomalies`
- PBT: Property 7 → 1 property testi × 100 iterasyon

#### `similarity.test.ts` (OLUŞTURULACAK)
- Birim: `normalizeTR`, `similarity`, `isExactMatch` — Türkçe karakter edge case'leri
- PBT: Property 8 → 1 property testi (3 alt özellik) × 100 iterasyon

#### `utils-tr.test.ts` (MEVCUT — tamamlanmış)
- Birim: `parseBankDate`, `formatBankDate`, `calcMarkup`, `calcMargin`
- PBT: Property 9-10 → 2 property testi × 100 iterasyon

#### `kapsamli-senaryo.test.ts` (MEVCUT)
- Senaryo: satış+iade round-trip, sipariş tamamlama
- PBT: Property 11-12 → 2 property testi × 100 iterasyon

#### `soba-satis-senaryosu.test.ts` (MEVCUT)
- Senaryo: 120 stok, 100/120/121 satış senaryoları
- Birim: kasa geliri, cari bakiye doğrulama

#### `e2e/example.spec.ts` (MEVCUT)
- Smoke: anasayfa yükleniyor, uygulama açılıyor

### Dışlanan Dosyalar

| Dosya | Neden Dışlandı |
|-------|---------------|
| `gercekci-senaryolar.test.ts` | Boş — içerik yok |
| `uygulama-gercek.test.ts` | Boş — içerik yok |
| `vy/**` | Yedek klasör — `src/` ile aynı |
| `e2e/**` | Playwright runner ile ayrı çalışır |

### CI/CD Entegrasyonu

```yaml
# Örnek GitHub Actions adımları
- name: Birim ve PBT testleri
  run: npm run test:run

- name: HTML raporu üret
  run: npm run test:report

- name: E2E testler
  run: npm run test:e2e
  env:
    CI: true
```

CI ortamında Playwright `retries: 2` ve `workers: 1` ile çalışır (playwright.config.ts'de tanımlı).
