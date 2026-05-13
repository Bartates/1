# PARSPEL — Soba Yönetim Sistemi

Soba satışı, stok, kasa ve cari takibini tek ekranda yöneten, offline-first çalışan bir işletme yönetim uygulaması.

## Başlamadan Önce

Bu projede geliştirmeye başlamadan önce aşağıdaki talimat dokümanını okuyun:


Bu doküman:
- proje mimarisini,
- agent yapısını,
- öncelikleri,
- test stratejisini,
- riskleri,
- uygulanacak geliştirme yaklaşımını tanımlar.

Zorunlu başlangıç kuralı:
- Yeni görev almadan önce bu dokümanı inceleyin.
- Geliştirme kararlarını bu talimata göre verin.
- Offline-first, IndexedDB, multi-agent yapı ve test disiplini temel kabul edilir.

## Özellikler

- **Satış Yönetimi** — Nakit / kart / cari ödeme, kısmi tahsilat, iskonto, iade ve iptal
- **Stok Takibi** — Giriş / çıkış / düzeltme, hareket geçmişi, sipariş entegrasyonu
- **Kasa** — Çoklu kasa (Nakit, Banka, POS), gelir/gider, soft-delete geri alımı
- **Cari Hesaplar** — Müşteri ve tedarikçi bakiyesi, alacak yaşlandırma, tahsilat
- **Tedarikçi & Sipariş** — Sipariş takibi, stok otomatik güncelleme
- **Fatura** — Satış ve alış faturaları, taksit planı
- **Raporlar & Dashboard** — Günlük ciro, kâr, stok değeri
- **Offline-First** — localStorage birincil depolama, Firebase Firestore opsiyonel bulut sync
- **PWA + Android** — Capacitor ile Android APK desteği
- **Rule Engine** — Her işlemde otomatik kural kontrolü (negatif stok, negatif kasa, sıfır tutar, mükerrer işlem)
- **Audit Log** — Tüm işlemlerin denetim kaydı

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| UI | Tailwind CSS 4 + Radix UI (shadcn/ui) |
| Mobil | Capacitor 8 (Android) |
| Test | Vitest + fast-check (property-based testing) |
| Depolama | localStorage + Firebase Firestore (opsiyonel) |

## Kurulum

```bash
npm install
npm run dev
```

## Komutlar

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run test         # Testleri izle (watch mode)
npm run test:run     # Testleri tek seferlik çalıştır
npm run typecheck    # TypeScript tip kontrolü
npm run cap:android  # Android build + Android Studio aç
```

## Test

```bash
# Tüm testleri çalıştır
npm run test:run

# Belirli test dosyası
npx vitest run src/lib/kapsamli-senaryo.test.ts
```

Test dosyaları `src/lib/` altında bulunur. Testler UI bağımlılığı olmadan saf fonksiyon olarak çalışır (`prevDB → işlem → nextDB` pattern).

## Firebase Sync (Opsiyonel)

Uygulama içi **Entegrasyonlar** sayfasından Firebase proje bilgilerini girerek bulut sync aktif edilebilir. Aktif edilmezse uygulama tamamen offline çalışır.

## Lisans

Özel kullanım.
