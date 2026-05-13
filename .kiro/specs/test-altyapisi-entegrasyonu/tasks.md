# Uygulama Planı: Test Altyapısı Entegrasyonu

## Genel Bakış

Bu plan, Parspel workspace'indeki test altyapısını çalışır hale getirmek için gereken kodlama adımlarını kapsar. Mevcut konfigürasyonların büyük çoğunluğu hazır olduğundan, odak noktaları şunlardır: `playwright.config.ts` port düzeltmesi, `src/lib/similarity.test.ts` oluşturulması ve tüm testlerin doğrulanması.

## Görevler

- [x] 1. Playwright konfigürasyonunu düzelt
  - `playwright.config.ts` içindeki `baseURL` değerini `http://localhost:5173` → `http://localhost:3000` olarak güncelle
  - `webServer.url` değerini de `http://localhost:3000` olarak güncelle
  - `vite.config.ts` içindeki `server.port: 3000` ile tutarlılığı sağla
  - _Gereksinimler: 11.3_

- [x] 2. `src/lib/similarity.test.ts` dosyasını oluştur
  - [x] 2.1 Birim testlerini yaz: `normalizeTR`, `similarity`, `isExactMatch`
    - `normalizeTR` için Türkçe karakter dönüşümlerini test et (`ğ→g`, `ü→u`, `ş→s`, `ı→i`, `ö→o`, `ç→c`)
    - `similarity("abc", "abc")` → 100 döndürdüğünü doğrula
    - `similarity("", "abc")` ve `similarity("abc", "")` → 0 döndürdüğünü doğrula
    - `isExactMatch` için normalize edilmiş eşleşme senaryolarını test et
    - _Gereksinimler: 6.1, 6.2, 6.3, 6.4_

  - [x]* 2.2 Property testi yaz: Benzerlik skoru aralık ve simetri invariantları
    - **Property 8: Benzerlik Skoru Aralık ve Simetri İnvariantları**
    - `similarity(a, b)` sonucunun 0–100 arasında olduğunu doğrula
    - `similarity(a, b) === similarity(b, a)` simetrisini doğrula
    - `similarity(s, s) === 100` self-similarity'yi doğrula
    - `fc.string()` arbitrary kullan, `numRuns: 100`
    - **Validates: Requirements 6.5, 6.6, 6.7**

- [x] 3. Kontrol noktası — Mevcut testlerin durumunu doğrula
  - `npm run test:run` komutunu çalıştır ve tüm mevcut test dosyalarının (`ruleEngine`, `auditEngine`, `dataIntegrityChecker`, `utils-tr`, `kapsamli-senaryo`, `soba-satis-senaryosu`) geçtiğini doğrula
  - Başarısız test varsa hataları gider
  - Tüm testler geçiyor, kullanıcıya soru varsa sor.
  - _Gereksinimler: 1.5, 13.1_

- [x] 4. `similarity.test.ts` testlerini çalıştır ve doğrula
  - [x] 4.1 `npm run test:run` ile `similarity.test.ts` dosyasının tüm testlerinin geçtiğini doğrula
    - Birim testleri ve PBT testlerinin hatasız çalıştığını kontrol et
    - _Gereksinimler: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x]* 4.2 `vy/` klasörü exclude kuralını doğrula
    - `vite.config.ts` içindeki `test.exclude` listesinde `'vy/**'` kuralının mevcut olduğunu kontrol et
    - `npm run test:run` çıktısında `vy/` altındaki dosyaların çalıştırılmadığını doğrula
    - _Gereksinimler: 1.4, 12.4_

- [x] 5. HTML raporu üretimini doğrula
  - `npm run test:report` komutunu çalıştır
  - `./test-report/index.html` dosyasının oluşturulduğunu doğrula
  - _Gereksinimler: 1.6, 13.2_

- [x] 6. Son kontrol noktası — Tüm testler ve raporlama
  - Tüm testler geçiyor ve HTML raporu üretiliyor, kullanıcıya soru varsa sor.
  - _Gereksinimler: 1.5, 1.6, 13.1, 13.2_

## Notlar

- `*` ile işaretli görevler isteğe bağlıdır; MVP için atlanabilir
- Her görev izlenebilirlik için ilgili gereksinimlere referans verir
- `playwright.config.ts` düzeltmesi (Görev 1) e2e testlerin çalışması için zorunludur
- `similarity.test.ts` (Görev 2) tek eksik test dosyasıdır; diğer tüm test dosyaları mevcuttur
- Property testleri evrensel doğruluk özelliklerini, birim testleri ise belirli örnekleri ve edge case'leri doğrular
