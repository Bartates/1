# PARSPEL — Değişiklik Geçmişi

Bu dosya, Kiro AI tarafından yapılan tüm değişikliklerin kaydını tutar.
Bir işlem hata yaratırsa buradan kontrol edebilirsiniz.

---

## v2.9.0 — 4 Mayıs 2026

### Yeni Özellikler
- **Quantum Link** — sağ altta floating AI panel (BrainCircuit ikonu)
  - Türkçe sesli komut (mikrofon butonu)
  - Kasa / stok / satış / alacak hızlı sorguları (offline, API gerektirmez)
  - Sesli yanıt (TTS, tr-TR)
  - Framer Motion animasyonlu açılış/kapanış
  - Dosya: `src/components/QuantumLink.tsx` (YENİ)
- **useDB analytics** — `useMemo` ile optimize edilmiş iş analitiği
  - `revenue`, `profit`, `margin`, `growth`, `kasaBalance`, `nakit`, `banka`
  - `lowStockItems`, `outOfStockItems`, `stockValue`
  - `totalReceivable`, `totalPayable`, `topProducts`, `monthSalesCount`
  - Dosya: `src/hooks/useDB.ts` (DEĞİŞTİ)
- **ESLint kurulumu** — `eslint.config.js` (YENİ)
  - `@typescript-eslint/eslint-plugin`
  - `@typescript-eslint/parser`
  - `eslint-plugin-react-hooks`
  - `npm run lint` ve `npm run lint:fix` scriptleri eklendi
- **requestPushPermission()** — Firebase Cloud Messaging izni
  - Dosya: `src/lib/permissions.ts` (DEĞİŞTİ)
- **Son güncelleme toast'u** — uygulama açılışında bir kez gösterilir
  - Dosya: `src/App.tsx` (DEĞİŞTİ)
- **CHANGELOG.md** — bu dosya (YENİ)

### İyileştirmeler
- `AndroidManifest.xml` — eksik izinler eklendi:
  - `POST_NOTIFICATIONS` (Android 13+)
  - `RECORD_AUDIO` (sesli AI asistan)
  - `CAMERA` (ileride barkod/QR)
  - `READ/WRITE_EXTERNAL_STORAGE` (Excel export)
  - `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`
  - Dosya: `android/app/src/main/AndroidManifest.xml` (DEĞİŞTİ)
- `README.md` — tamamen yenilendi:
  - Tam uygulama haritası (tüm sayfalar)
  - Android izin tablosu
  - Sürüm geçmişi
  - AI kurulum talimatları
- `package.json` — versiyon `2.0.0` → `2.9.0`
- `android/app/build.gradle` — `versionCode 1`, `versionName "2.9"`
- `src/lib/changelog.ts` — v2.9.0 girişi eklendi
- Ayarlar → Temalar: `SoundSettings` fonksiyonu `SoundSettingsPanel` olarak yeniden adlandırıldı (interface ile çakışma giderildi)
- Ayarlar → Temalar: Açık/koyu mod toggle kaldırıldı, tek düz koyu tema grid'i kaldı
- 2 yeni koyu tema eklendi: **Lacivert** (`#6366f1`) ve **Titan** (saf siyah)

### Düzeltmeler (ESLint/TypeScript Taraması)
| Dosya | Hata | Düzeltme |
|---|---|---|
| `src/hooks/useDB.ts` | `productId` undefined → analytics çöküyor | `?? s.productName ?? 'bilinmiyor'` ile güvence altına alındı |
| `src/hooks/useDB.ts` | Template literal `\'` escape hatası | Düz tırnak kullanıldı |
| `src/lib/utils-tr.ts` | Regex `\/` gereksiz escape | `[.\-/]` olarak düzeltildi |
| `src/components/Toast.tsx` | Emoji character class misleading | Unicode range ile yeniden yazıldı |
| `src/pages/Settings.tsx` | `SoundSettings` çift tanım (redeclare) | `SoundSettingsPanel` olarak yeniden adlandırıldı |
| `src/pages/Settings.tsx` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/pages/Settings.tsx` | `fetchCurrentHash`, `updateHashInFirebase` dead code | Kaldırıldı |
| `src/pages/Settings.tsx` | `saveUsers`, `APP_NAME` kullanılmayan import | Kaldırıldı |
| `src/pages/Dashboard.tsx` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/components/NotificationCenter.tsx` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/hooks/useUIPrefs.ts` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/lib/connConfig.ts` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/lib/offline-ai.ts` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |
| `src/App.tsx` | Boş `catch {}` bloğu | Açıklayıcı yorum eklendi |

### Kaldırılanlar
- Açık temalar tamamen kaldırıldı: Kartal, Siyah/Ak, Amber, Deniz, Çimen, Güneş, Beton, Kontrast
- Ayarlar'dan açık/koyu mod toggle kaldırıldı

### Tarama Sonuçları
```
Başlangıç:  14 hata,  95 uyarı
Son durum:   0 hata,  86 uyarı  ✅
TypeScript:  0 hata              ✅
Testler:   197/197 geçti         ✅
```

### Git
- Commit: `f79cb33`
- Branch: `main`
- Remote: `github.com/fevzisolhan/parspel`

---

## v2.0.0 — 14 Nisan 2026

### Yeni Özellikler
- Uygulama adı PARSPEL olarak değiştirildi
- İkon seçici (IconPicker) — emoji, URL ve Lucide desteği
- Sistem haritası — modüller arası ilişki diyagramı
- Sürüm kitapçığı — tüm değişiklik geçmişi
- Tam Geri Yükleme ve Birleştirme modları ayrıldı
- Geri yükleme öncesi otomatik yedek alınıyor
- Yedek limiti (max 20) — eski yedekler otomatik siliniyor
- Referans bütünlüğü onarımı (repairReferentialIntegrity)
- Ad kalite kontrolü — boş/tek haneli/sadece sayı adlar reddediliyor

### Düzeltmeler
- Kasa.tsx `(db as any).partners` tip güvensizliği giderildi
- SelectiveRestore artık Firebase ile senkronize
- Dashboard restore Firebase'e yazıyor

---

## v1.5.0 — Mart 2026

- Firebase Backup koleksiyonu — versiyonlu yedekler
- Her 10 versiyonda otomatik yedek
- dataIntegrityChecker — localStorage boyut izleme
- stockMovements max 1000 kayıt limiti
- Bütçe banka ekstresi tarih kaybı düzeltildi
- Fatura taslak→onaylı→taslak cari çift güncelleme düzeltildi

---

## v1.4.0 — Şubat 2026

- QuickSaleModal — cari bakiye güncellenmiyordu (düzeltildi)
- QuickSaleModal — stockMovements kaydedilmiyordu (düzeltildi)
- Bank.tsx — silme sırasında cari yanlış geri alınıyordu (düzeltildi)
- Partners — ortak silinirken cari/emanet silinmiyordu (düzeltildi)
- Dashboard — POS kasaları net sermayeye dahil değildi (düzeltildi)
- calcProfit/calcMarkup/calcMargin ayrı fonksiyonlar

---

## v1.3.0 — Ocak 2026

- Banka ekstresi içe aktarma (CSV/XLSX)
- Bütçe kategorileri ve aylık limit takibi
- Banka işlemi cari eşleştirme
- Alacak yaşlandırma bandı (0-7, 8-30, 31-60, 60+ gün)
- Cari detay modalı — fatura geçmişi eklendi

---

## v1.2.0 — Aralık 2025

- Fatura oluşturma (satış/alış), KDV hesaplama
- Taksit planı — otomatik ödeme takvimi
- Fatura durum geçişleri (taslak→onaylı→ödendi→iptal)
- Fatura yazdırma önizlemesi

---

## v1.1.0 — Kasım 2025

- Capacitor 8 — Android native desteği
- PWA — offline çalışma, ana ekrana ekle
- Dosya sistemi — Android'de JSON yedek kaydetme
- Mobil uyumlu arayüz iyileştirmeleri

---

## v1.0.0 — Ekim 2025

- İlk sürüm: Soba Yönetim Sistemi
- Ürün & stok yönetimi
- Satış kayıtları
- Kasa hareketleri (nakit/banka)
- Cari hesaplar (müşteri/tedarikçi)
- Firebase Firestore senkronizasyonu
- localStorage birincil depolama
- Tedarikçi & sipariş yönetimi
- Pelet & boru tedarik modülleri
