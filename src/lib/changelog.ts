/**
 * PARSPEL — Sürüm Geçmişi (Changelog)
 * Her sürüm için değişiklikler, yeni özellikler ve düzeltmeler.
 */

export type ChangeType = 'yeni' | 'iyilestirme' | 'duzeltme' | 'kaldirildi';

export interface ChangeEntry {
  type: ChangeType;
  text: string;
}

export interface VersionEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: ChangeEntry[];
}

export const CHANGELOG: VersionEntry[] = [
  {
    version: '3.0.0',
    date: '9 Mayıs 2026',
    title: 'Release v3.0.0',
    summary: 'Multi-agent orkestrasyonu, IndexedDB snapshot dayanıklılığı ve AI aksiyon fallback akışı eklendi. Canlı sürüm görünürlüğü iyileştirildi.',
    changes: [
      { type: 'yeni', text: 'Multi-agent altyapısı: bus, base agent, registry ve orchestrator eklendi' },
      { type: 'yeni', text: 'Dexie tabanlı IndexedDB snapshot yazma/geri yükleme akışı eklendi' },
      { type: 'iyilestirme', text: 'AI asistan aksiyonlarında fail-soft fallback zinciri uygulandı' },
      { type: 'iyilestirme', text: 'Giriş ekranı sürüm etiketi v3.0.0 olarak görünür hale getirildi' },
      { type: 'duzeltme', text: 'Anomali motorunda strict TypeScript uyumu için tip güvenliği düzeltmeleri yapıldı' },
    ],
  },
  {
    version: '2.9.0',
    date: '4 Mayıs 2026',
    title: 'Quantum Link AI Panel & Kod Kalitesi',
    summary: 'Quantum Link floating AI paneli eklendi. Android izinleri genişletildi. ESLint kuruldu, 14 kod hatası giderildi. TypeScript tip hataları düzeltildi. Açık temalar kaldırıldı.',
    changes: [
      { type: 'yeni', text: 'Quantum Link — her sayfadan erişilebilir floating AI panel (BrainCircuit ikonu)' },
      { type: 'yeni', text: 'Quantum Link — Türkçe sesli komut (mikrofon) + TTS yanıt' },
      { type: 'yeni', text: 'Quantum Link — kasa/stok/satış/alacak hızlı sorguları (offline)' },
      { type: 'yeni', text: 'useDB analytics useMemo — revenue, profit, margin, growth, topProducts vb.' },
      { type: 'yeni', text: 'ESLint kuruldu — @typescript-eslint + react-hooks kuralları' },
      { type: 'yeni', text: 'requestPushPermission() — Firebase Cloud Messaging izni' },
      { type: 'yeni', text: 'CHANGELOG.md — GitHub\'da okunabilir işlem geçmişi' },
      { type: 'iyilestirme', text: 'AndroidManifest.xml — POST_NOTIFICATIONS, RECORD_AUDIO, CAMERA, depolama izinleri eklendi' },
      { type: 'iyilestirme', text: 'README.md — tam uygulama haritası, izin tablosu, sürüm geçmişi' },
      { type: 'iyilestirme', text: 'SoundSettings fonksiyonu SoundSettingsPanel olarak yeniden adlandırıldı (çakışma giderildi)' },
      { type: 'iyilestirme', text: 'Toast.tsx emoji regex — misleading character class düzeltildi' },
      { type: 'duzeltme', text: 'useDB.ts — productId undefined olduğunda analytics çökmesi düzeltildi' },
      { type: 'duzeltme', text: 'useDB.ts — Firebase log template literal escape hatası düzeltildi' },
      { type: 'duzeltme', text: 'utils-tr.ts — regex gereksiz escape karakterleri temizlendi' },
      { type: 'duzeltme', text: '6 boş catch {} bloğu — açıklayıcı yorum eklendi (no-empty)' },
      { type: 'duzeltme', text: 'fetchCurrentHash, updateHashInFirebase — kullanılmayan dead code kaldırıldı' },
      { type: 'kaldirildi', text: 'Açık temalar kaldırıldı (Kartal, Siyah/Ak, Amber, Deniz, Çimen, Güneş, Beton, Kontrast)' },
      { type: 'kaldirildi', text: 'Ayarlar\'dan açık/koyu mod toggle kaldırıldı' },
    ],
  },
  {
    version: '2.0.0',
    date: '14 Nisan 2026',
    title: 'PARSPEL — Yeniden Doğuş',
    summary: 'Uygulama adı PARSPEL olarak güncellendi. Yedekleme sistemi tamamen yeniden yazıldı. İkon kütüphanesi ve sistem haritası eklendi.',
    changes: [
      { type: 'yeni', text: 'Uygulama adı PARSPEL olarak değiştirildi' },
      { type: 'yeni', text: 'İkon seçici (IconPicker) — emoji, URL ve Lucide desteği' },
      { type: 'yeni', text: 'Sistem haritası — modüller arası ilişki diyagramı' },
      { type: 'yeni', text: 'Sürüm kitapçığı — tüm değişiklik geçmişi' },
      { type: 'yeni', text: 'Tam Geri Yükleme ve Birleştirme modları ayrıldı' },
      { type: 'yeni', text: 'Geri yükleme öncesi otomatik yedek alınıyor' },
      { type: 'yeni', text: 'Yedek limiti (max 20) — eski yedekler otomatik siliniyor' },
      { type: 'yeni', text: 'Referans bütünlüğü onarımı (repairReferentialIntegrity)' },
      { type: 'yeni', text: 'Ad kalite kontrolü — boş/tek haneli/sadece sayı adlar reddediliyor' },
      { type: 'iyilestirme', text: 'SelectiveRestore artık Firebase ile senkronize' },
      { type: 'iyilestirme', text: 'Dashboard restore Firebase\'e yazıyor' },
      { type: 'duzeltme', text: 'Kasa.tsx (db as any).partners tip güvensizliği giderildi' },
    ],
  },
  {
    version: '1.5.0',
    date: 'Mart 2026',
    title: 'Yedekleme & Veri Güvenliği',
    summary: 'Yedekleme altyapısı güçlendirildi. Veri bütünlüğü kontrolleri eklendi.',
    changes: [
      { type: 'yeni', text: 'Firebase Backup koleksiyonu — versiyonlu yedekler' },
      { type: 'yeni', text: 'Her 10 versiyonda otomatik yedek' },
      { type: 'yeni', text: 'dataIntegrityChecker — localStorage boyut izleme' },
      { type: 'yeni', text: 'stockMovements max 1000 kayıt limiti' },
      { type: 'duzeltme', text: 'Bütçe banka ekstresi tarih kaybı düzeltildi' },
      { type: 'duzeltme', text: 'Fatura taslak→onaylı→taslak cari çift güncelleme düzeltildi' },
    ],
  },
  {
    version: '1.4.0',
    date: 'Şubat 2026',
    title: 'Muhasebe Düzeltmeleri',
    summary: 'Kritik muhasebe hataları giderildi. Cari bakiye hesaplamaları düzeltildi.',
    changes: [
      { type: 'duzeltme', text: 'QuickSaleModal — cari bakiye güncellenmiyordu' },
      { type: 'duzeltme', text: 'QuickSaleModal — stockMovements kaydedilmiyordu' },
      { type: 'duzeltme', text: 'Bank.tsx — silme sırasında cari yanlış geri alınıyordu' },
      { type: 'duzeltme', text: 'Partners — ortak silinirken cari/emanet silinmiyordu' },
      { type: 'duzeltme', text: 'Dashboard — POS kasaları net sermayeye dahil değildi' },
      { type: 'iyilestirme', text: 'calcProfit/calcMarkup/calcMargin ayrı fonksiyonlar' },
    ],
  },
  {
    version: '1.3.0',
    date: 'Ocak 2026',
    title: 'Banka & Bütçe Modülleri',
    summary: 'Banka ekstresi içe aktarma ve bütçe kategorileri eklendi.',
    changes: [
      { type: 'yeni', text: 'Banka ekstresi içe aktarma (CSV/XLSX)' },
      { type: 'yeni', text: 'Bütçe kategorileri ve aylık limit takibi' },
      { type: 'yeni', text: 'Banka işlemi cari eşleştirme' },
      { type: 'yeni', text: 'Alacak yaşlandırma bandı (0-7, 8-30, 31-60, 60+ gün)' },
      { type: 'iyilestirme', text: 'Cari detay modalı — fatura geçmişi eklendi' },
    ],
  },
  {
    version: '1.2.0',
    date: 'Aralık 2025',
    title: 'Fatura & Taksit Sistemi',
    summary: 'Fatura yönetimi ve taksit planı eklendi.',
    changes: [
      { type: 'yeni', text: 'Fatura oluşturma (satış/alış), KDV hesaplama' },
      { type: 'yeni', text: 'Taksit planı — otomatik ödeme takvimi' },
      { type: 'yeni', text: 'Fatura durum geçişleri (taslak→onaylı→ödendi→iptal)' },
      { type: 'yeni', text: 'Fatura yazdırma önizlemesi' },
    ],
  },
  {
    version: '1.1.0',
    date: 'Kasım 2025',
    title: 'Android & PWA Desteği',
    summary: 'Capacitor ile Android APK desteği eklendi.',
    changes: [
      { type: 'yeni', text: 'Capacitor 8 — Android native desteği' },
      { type: 'yeni', text: 'PWA — offline çalışma, ana ekrana ekle' },
      { type: 'yeni', text: 'Dosya sistemi — Android\'de JSON yedek kaydetme' },
      { type: 'iyilestirme', text: 'Mobil uyumlu arayüz iyileştirmeleri' },
    ],
  },
  {
    version: '1.0.0',
    date: 'Ekim 2025',
    title: 'İlk Sürüm',
    summary: 'Soba Yönetim Sistemi olarak ilk yayın.',
    changes: [
      { type: 'yeni', text: 'Ürün & stok yönetimi' },
      { type: 'yeni', text: 'Satış kayıtları' },
      { type: 'yeni', text: 'Kasa hareketleri (nakit/banka)' },
      { type: 'yeni', text: 'Cari hesaplar (müşteri/tedarikçi)' },
      { type: 'yeni', text: 'Firebase Firestore senkronizasyonu' },
      { type: 'yeni', text: 'localStorage birincil depolama' },
      { type: 'yeni', text: 'Tedarikçi & sipariş yönetimi' },
      { type: 'yeni', text: 'Pelet & boru tedarik modülleri' },
    ],
  },
];

export const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string }> = {
  yeni:        { label: '✨ Yeni',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  iyilestirme: { label: '⚡ İyileştirme', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  duzeltme:    { label: '🔧 Düzeltme',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  kaldirildi:  { label: '🗑️ Kaldırıldı',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};
