# Audit & Deprecation Report

Tarih: 2026-05-12

1) Güvenlik taraması
- `npm audit` sonucu: bilinen güvenlik açığı bulunamadı (vulnerabilities: 0).

2) Önemli güncelleme önerileri (öncelikliler)
- `react` / `react-dom`: mevcut `19.1.0` → son `19.2.6`. Küçük uyumluluk riski, öneri: testli yükseltme PR.
- `vite`: mevcut `7.3.3` → `8.0.12` (major). Yükseltme Vite 8 değişiklikleri gerektirebilir; ayrı PR ile.
- `zod`: mevcut `3.25.76` → `4.4.3` (major). Tip/göç değişiklikleri gerekebilir.
- `date-fns`: `3.6.0` → `4.1.0` (major). API farklarını kontrol edin.

3) Hızlı aksiyon planı
- Küçük/patch güncellemeleri: `npm update --depth 0` (zaten uygulandı).
- Major yükseltmeler: ayrı branch + CI + tam test (vitest + e2e) ile aşamalı uygulanmalı.
- `vite` ve `zod` için önceliklendirme: `vite` yükseltmesi ilk (build/test infra), ardından `zod`.

4) Encoding/Deprecation notları
- Projede eski `glob`, `rimraf`, `uuid` gibi paket uyarıları var; bunlar `npm update` ile azaltıldı. Major sürüm migration'ları gözden geçirilmeli.

5) Artefaktlar
- `.outdated.json` ve `.audit.json` workspace kökünde oluşturuldu.

İlgili dosyalar:
- `REPORT-QUOTA.md` (quota mitigations)
- `.outdated.json`
- `.audit.json`

İsterseniz ben sırayla major yükseltme PR'larını oluşturup testleri çalıştırıp merge-ready hale getirebilirim.
# Audit Özeti — Deprecations, Encoding, Güvenlik (kısa)

Tarih: 2026-05-12

Yapılanlar
- `scripts/setUserPassword.cjs` eklendi — localStorage içinden `soba_users_cache` güncelleyerek parola sıfırlama.
- `scripts/verifyLoginAndScreenshots.cjs` eklendi — otomatik giriş denemesi ve 3 boyutta ekran görüntüsü alır.
- `scripts/monitorConsole.js` eklendi — Playwright ile canlı konsol toplama.
- Güvenli (wanted) paket güncellemeleri uygulandı (`npm update --depth 0`) ve `npm ci` çalıştırıldı.
- Typecheck, lint ve testler çalıştırıldı — tüm testler geçti (255/255).

Bulunan yüksek seviyeli bulgular
- Paket uyarıları: `glob`, `rimraf`, `uuid`, `inflight` gibi bağımlılıklarda deprecated/taşınma uyarıları. Çoğu transitive; `npm update` ile wanted sürümlere yükseltildi. Major yükseltmeler (örn. React 19.2.x, Vite 8.x, date-fns 4.x, Zod 4.x) NOT: bazı major yükseltmeler `npm update --depth 0` ile otomatik gelmedi — manuel değerlendirme gerekebilir.
- Test zamanı uyarısı: `--localstorage-file` ile ilgili Node uyarısı görünüyor; repo içinde bu flag bulunmuyor — muhtemelen test runner (jsdom / vitest) veya environment üzerinden geliyor; izlenmeli.
- Encoding / locale: proje genelinde `TextEncoder`/`TextDecoder`, `toLocaleDateString('tr-TR')` gibi doğru locale kullanımları var; ayrıca CSV/Excel import işlemlerinde `reader.readAsText(file, 'utf-8')` kullanılıyor — encoding hatası görünmüyor.
- localStorage riskleri: uygulama offline-first olarak localStorage'a yoğun güveniyor; `dataIntegrityChecker` ve `healthCheck` bu riskleri zaten izliyor. Yine de `QuotaExceededError` durumları için daha sıkı uyarı/temizleme önerisi var.
- Güvenlik: hassas verilerin localStorage'da tutulması (hatırlama tokenleri, kullanıcı hash'leri) risk oluşturuyor; XSS önlemleri ve production'da console.log temizliği öneriliyor.

Önerilen yüksek öncelikli düzeltmeler (adım adım)
1. `console` maskesi: production build'te hassas veri sızdıran console çıktılarının bastırılması (logger merkezileştirilmiş — prod'da `debug/info` kapatılmalı).
2. Riskli major paketlerin (React, Vite, date-fns, zod) yükseltmeleri ayrı branch ve test PR'larında denenmeli.
3. `--localstorage-file` uyarısının kaynağı araştırılmalı (test config veya CI image). Eğer test runner argümanı ise test komutları güncellenmeli.
4. localStorage quota hataları için otomatik trim/rotaion: büyük audit logları veya eski yedekleri otomatik temizle.

Kısa yol haritası (benim önerim)
- Öncelik A: Production konsol temizliği (logger config) — hızlı uygulanabilir.
- Öncelik B: localStorage quota mitigasyon (logger limitleri, yedek rotaion) — orta.
- Öncelik C: Major dependency yükseltmeleri — riskli, PR ve kapsamlı test gerektirir.

Mevcut durum: gerekli scriptler eklendi, istenen parola reset işlemi gerçekleştirildi ve doğrulamaya ait ekran görüntüleri alındı. Bir sonraki adım olarak Production logger değişikliğini uygulayıp test edeyim mi, yoksa önce major paket yükseltmelerine mi geçeyim?
