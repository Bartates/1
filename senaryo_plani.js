const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, PageBreak, VerticalAlign, TableOfContents
} = require('docx');
const fs = require('fs');

// ─── Renkler ───────────────────────────────────────────────────────────
const RED    = "C0392B";
const AMBER  = "D68910";
const GREEN  = "1E8449";
const BLUE   = "1A5276";
const GRAY   = "5D6D7E";
const LIGHT_RED   = "FADBD8";
const LIGHT_AMBER = "FDEBD0";
const LIGHT_GREEN = "D5F5E3";
const LIGHT_BLUE  = "D6EAF8";
const LIGHT_GRAY  = "EAECEE";
const HEADER_BG   = "1A3A5C";
const WHITE  = "FFFFFF";

// ─── Helpers ───────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const thickBorder = { style: BorderStyle.SINGLE, size: 4, color: HEADER_BG };
const thickBorders = { top: thickBorder, bottom: thickBorder, left: thickBorder, right: thickBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: HEADER_BG, space: 4 } },
    children: [new TextRun({ text, font: "Arial", size: 30, bold: true, color: HEADER_BG })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: BLUE })]
  });
}

function h3(text, color = "2C3E50") {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color })]
  });
}

function para(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: "2C3E50", ...options })]
  });
}

function bullet(text, indent = 360) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    indent: { left: indent },
    children: [new TextRun({ text, font: "Arial", size: 20, color: "2C3E50" })]
  });
}

function bullet2(text) {
  return new Paragraph({
    numbering: { reference: "bullets2", level: 0 },
    spacing: { before: 30, after: 30 },
    indent: { left: 720 },
    children: [new TextRun({ text, font: "Arial", size: 19, color: "5D6D7E" })]
  });
}

function fixNote(text) {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "✓ Çözüm: ", font: "Arial", size: 19, bold: true, color: GREEN }),
      new TextRun({ text, font: "Arial", size: 19, color: GREEN })
    ]
  });
}

function warnNote(text) {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "⚠ Dikkat: ", font: "Arial", size: 19, bold: true, color: AMBER }),
      new TextRun({ text, font: "Arial", size: 19, color: AMBER })
    ]
  });
}

function riskLabel(text, color) {
  return new TextRun({ text: ` [${text}] `, font: "Arial", size: 18, bold: true, color });
}

function riskPara(label, labelColor, title, desc) {
  return new Paragraph({
    spacing: { before: 80, after: 40 },
    children: [
      riskLabel(label, labelColor),
      new TextRun({ text: title, font: "Arial", size: 20, bold: true, color: "1C2833" }),
      new TextRun({ text: "  " + desc, font: "Arial", size: 19, color: "5D6D7E" })
    ]
  });
}

function spacer(lines = 1) {
  return new Paragraph({ spacing: { before: 0, after: lines * 80 }, children: [new TextRun("")] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((c, i) => new TableCell({
      borders,
      shading: { fill: isHeader ? HEADER_BG : (c.bg || WHITE), type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      width: { size: c.w || 2000, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: c.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({
          text: c.text,
          font: "Arial",
          size: isHeader ? 19 : 18,
          bold: isHeader || c.bold || false,
          color: isHeader ? WHITE : (c.color || "2C3E50")
        })]
      })]
    }))
  });
}

function infoBox(text, bg = LIGHT_BLUE, color = BLUE) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    indent: { left: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color } },
    shading: { fill: bg, type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Arial", size: 19, color: "1C2833" })]
  });
}

// ─── CONTENT ───────────────────────────────────────────────────────────

const children = [

  // ══════════════════════════════════════════════════════
  // KAPAK
  // ══════════════════════════════════════════════════════
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200 },
    children: [new TextRun({ text: "SOBA YÖNETİM SİSTEMİ", font: "Arial", size: 40, bold: true, color: HEADER_BG })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: "Tam Senaryo Planı — Veri Bütünlüğü & Risk Analizi", font: "Arial", size: 28, color: GRAY })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: "Yedekleme · Geri Yükleme · Satış · Cari · Kasa · Stok · Silme & Düzeltme", font: "Arial", size: 20, color: GRAY })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 2400 },
    children: [new TextRun({ text: "Nisan 2026 — Dev Branch", font: "Arial", size: 19, color: GRAY })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: HEADER_BG } },
    children: [new TextRun({ text: "Tüm modüller: Sales · Cari · Kasa · Bank · Products · StockMovements · Installments · Returns · Reports · Budget", font: "Arial", size: 17, color: GRAY })]
  }),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 1: YEDEKLEME SİSTEMİ
  // ══════════════════════════════════════════════════════
  h1("1. YEDEKLEME SİSTEMİ"),

  h2("1.1 Otomatik Yedek Tetikleyicileri"),
  para("Şu an yalnızca manuel export mevcut. Aşağıdaki anlarda otomatik yedek alınmalıdır:"),
  bullet("Her satış tamamlandıktan sonra (debounce 30 sn — her satışta değil, birikimli yaz)"),
  bullet("Kasa kapanışı / gün sonu — günlük snapshot"),
  bullet("Banka hareketi toplu eşleştirme tamamlandıktan sonra — kritik değişim noktası"),
  bullet("Manuel yedek butonu — her zaman erişilebilir"),
  bullet("Uygulama kapanmadan önce: beforeunload event → localStorage'a dirty flag + mini snapshot"),
  fixNote("Yedek JSON içine _version, _exportedAt, _schemaVersion, checksum (SHA-256 veya basit hash) alanları zorunlu olmalı."),
  spacer(),

  h2("1.2 Yedek İçeriği — Zorunlu Tablo Listesi"),
  para("Aşağıdaki tablolardan herhangi biri yedekte eksik kalırsa kısmi geri yükleme yapılamaz:"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2200, 3500, 3326],
    rows: [
      tableRow([
        { text: "Tablo", w: 2200 },
        { text: "Eksik kalırsa ne olur?", w: 3500 },
        { text: "Öncelik", w: 3326 }
      ], true),
      tableRow([{ text: "sales", w: 2200 }, { text: "Satış geçmişi yok, kasa/cari bağlantısı kopuk", w: 3500 }, { text: "KRİTİK", w: 3326, color: RED, bold: true }]),
      tableRow([{ text: "cari", w: 2200, bg: LIGHT_GRAY }, { text: "Müşteri bakiyeleri sıfırlanır", w: 3500, bg: LIGHT_GRAY }, { text: "KRİTİK", w: 3326, bg: LIGHT_GRAY, color: RED, bold: true }]),
      tableRow([{ text: "kasa / kasalar", w: 2200 }, { text: "Nakit bakiye bilinmiyor", w: 3500 }, { text: "KRİTİK", w: 3326, color: RED, bold: true }]),
      tableRow([{ text: "stockMovements", w: 2200, bg: LIGHT_GRAY }, { text: "Stok yeniden sayılamamaz, geçmiş yok", w: 3500, bg: LIGHT_GRAY }, { text: "KRİTİK", w: 3326, bg: LIGHT_GRAY, color: RED, bold: true }]),
      tableRow([{ text: "products", w: 2200 }, { text: "Ürün fiyat/maliyet geçmişi gider", w: 3500 }, { text: "KRİTİK", w: 3326, color: RED, bold: true }]),
      tableRow([{ text: "installments", w: 2200, bg: LIGHT_GRAY }, { text: "Taksit planları silinir", w: 3500, bg: LIGHT_GRAY }, { text: "YÜKSEK", w: 3326, bg: LIGHT_GRAY, color: AMBER, bold: true }]),
      tableRow([{ text: "bankTransactions", w: 2200 }, { text: "Eşleştirilmiş hareketler kaybolur", w: 3500 }, { text: "YÜKSEK", w: 3326, color: AMBER, bold: true }]),
      tableRow([{ text: "returns", w: 2200, bg: LIGHT_GRAY }, { text: "İade geçmişi yok, stok hatalı", w: 3500, bg: LIGHT_GRAY }, { text: "YÜKSEK", w: 3326, bg: LIGHT_GRAY, color: AMBER, bold: true }]),
      tableRow([{ text: "_activityLog", w: 2200 }, { text: "Denetim izi kaybolur", w: 3500 }, { text: "ORTA", w: 3326, color: BLUE, bold: true }]),
      tableRow([{ text: "settings", w: 2200, bg: LIGHT_GRAY }, { text: "KDV, firma bilgisi, tercihler kaybolur", w: 3500, bg: LIGHT_GRAY }, { text: "ORTA", w: 3326, bg: LIGHT_GRAY, color: BLUE, bold: true }]),
      tableRow([{ text: "peletOrders / boruOrders", w: 2200 }, { text: "WAC geçmişi ve alım kayıtları gider", w: 3500 }, { text: "YÜKSEK", w: 3326, color: AMBER, bold: true }]),
      tableRow([{ text: "orders / suppliers", w: 2200, bg: LIGHT_GRAY }, { text: "Tedarikçi geçmişi kaybolur", w: 3500, bg: LIGHT_GRAY }, { text: "ORTA", w: 3326, bg: LIGHT_GRAY, color: BLUE, bold: true }]),
    ]
  }),
  spacer(),

  h2("1.3 Yedek Doğrulama (Checksum)"),
  bullet("Yedek JSON'u oluştururken checksum alanına tüm verinin hash'ini yaz"),
  bullet("Geri yükleme öncesi checksum yeniden hesaplanır — eşleşmiyorsa 'bozuk yedek' uyarısı"),
  bullet("Dosya boyutu 0 veya çok küçükse (< 1KB) otomatik red"),
  bullet("_schemaVersion mevcut uygulama versiyonu ile uyuşmuyorsa migration uyarısı göster"),
  bullet("JSON parse hatası → hiçbir şeyi yazma, kullanıcıya hata göster"),
  spacer(),

  h2("1.4 Yedek Saklama Stratejisi"),
  bullet("localStorage: son 3 otomatik yedek + son 1 manuel (key: backup_auto_0/1/2, backup_manual)"),
  bullet("IndexedDB: daha büyük yedekler için (5MB+ veri)"),
  bullet("Dosya export: tarih damgalı — soba-yedek-2026-04-27.json"),
  bullet("Yedek rotasyonu: en eski silinir, yeni yazılır — localStorage dolmasını önler"),
  bullet("Kritik işlem öncesi otomatik snapshot: silme, toplu eşleştirme, import öncesi"),
  warnNote("localStorage 5MB sınırı. Büyük veri + yedek birlikte saklanınca dolabilir. QuotaExceededError sessizce veri kaybına yol açar — yakalanmalı."),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 2: GERİ YÜKLEME
  // ══════════════════════════════════════════════════════
  h1("2. TAM GERİ YÜKLEME"),

  h2("2.1 Doğru Yükleme Sırası (9 Adım — Sıra Bağımlı)"),
  infoBox("Adımların sırası değişirse tablo bağımlılıkları nedeniyle tutarsız veri oluşur. Aşağıdaki sıra zorunludur.", LIGHT_BLUE, BLUE),
  spacer(),
  bullet("Adım 1 — Yedek dosyasını parse et (hata → dur, mevcut veriyi dokunma)"),
  bullet("Adım 2 — Checksum doğrula (uyuşmuyorsa uyar, kullanıcı onayı ile devam)"),
  bullet("Adım 3 — Schema versiyon kontrolü (_schemaVersion — eski versiyon migration gerektirebilir)"),
  bullet("Adım 4 — Mevcut verinin yedeğini al (geri yükleme öncesi otomatik snapshot)"),
  bullet("Adım 5 — Tüm mevcut veriyi temizle"),
  bullet("Adım 6 — Tabloları bağımlılık sırasına göre yükle:"),
  bullet2("settings → products → suppliers → cari → sales → stockMovements → kasa → kasalar → bankTransactions → installments → returns → _activityLog"),
  bullet("Adım 7 — Referans bütünlüğünü doğrula (satışlardaki cariId → cari tablosunda var mı?)"),
  bullet("Adım 8 — Bakiyeleri yeniden hesapla ve karşılaştır (uyuşmazlık varsa kullanıcıya göster)"),
  bullet("Adım 9 — Başarı bildirimi + uygulama yenile"),
  spacer(),

  h2("2.2 Hatalı / Bozuk Yedekten Geri Yükleme Riskleri"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2400, 3300, 3326],
    rows: [
      tableRow([{ text: "Hata türü", w: 2400 }, { text: "Sonuç", w: 3300 }, { text: "Çözüm", w: 3326 }], true),
      tableRow([{ text: "JSON parse hatası", w: 2400 }, { text: "Hiçbir şey yüklenemez", w: 3300 }, { text: "Try-catch → hata mesajı, mevcut veri korunur", w: 3326 }]),
      tableRow([{ text: "Eksik tablo / alan", w: 2400, bg: LIGHT_GRAY }, { text: "Kısmi yükleme → tutarsız veri", w: 3300, bg: LIGHT_GRAY }, { text: "Zorunlu alan kontrolü, eksik tablo uyarısı", w: 3326, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Yanlış tarih formatı", w: 2400 }, { text: "Sıralama/filtreleme bozulur", w: 3300 }, { text: "ISO 8601 standardize et yükleme sırasında", w: 3326 }]),
      tableRow([{ text: "Negatif stok değeri", w: 2400, bg: LIGHT_GRAY }, { text: "Stok saçma görünür", w: 3300, bg: LIGHT_GRAY }, { text: "min(0) clamp veya kullanıcıya uyarı", w: 3326, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Null / undefined bakiye", w: 2400 }, { text: "Hesaplamalar NaN döner", w: 3300 }, { text: "Default 0 ile yükle + log", w: 3326 }]),
      tableRow([{ text: "Duplicate ID'ler", w: 2400, bg: LIGHT_GRAY }, { text: "Üzerine yazma, kayıp", w: 3300, bg: LIGHT_GRAY }, { text: "ID unique kontrolü, conflict resolution", w: 3326, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Silinen kayıtlar restore", w: 2400 }, { text: "Soft-delete'ler geri gelir", w: 3300 }, { text: "deleted:true olanları filtreli göster", w: 3326 }]),
      tableRow([{ text: "Eski schema versiyonu", w: 2400, bg: LIGHT_GRAY }, { text: "Eksik alan → runtime hata", w: 3300, bg: LIGHT_GRAY }, { text: "migrateV1toV2() migration fonksiyonu", w: 3326, bg: LIGHT_GRAY }]),
    ]
  }),
  spacer(),

  h2("2.3 Bakiye Yeniden Hesaplama (Reconciliation)"),
  infoBox("Geri yükleme sonrası bakiyeler asla yedekteki değerle direkt kabul edilmemeli — her zaman yeniden hesaplanmalı.", LIGHT_AMBER, AMBER),
  spacer(),
  bullet("Cari bakiye: tüm satışlar + taksit ödemeleri + iadeler → hesapla, yedekteki bakiye ile karşılaştır"),
  bullet("Kasa bakiyesi: kasa hareketleri toplamı → kasaların balance alanı ile karşılaştır"),
  bullet("Stok: stockMovements toplamı → products.stock ile karşılaştır"),
  bullet("Fark varsa kullanıcıya göster: 'Hesaplanan bakiye: 15.200₺, yedekteki: 14.800₺ — 400₺ fark'"),
  bullet("Kullanıcı 'hesaplananı kullan' veya 'yedektekini kullan' seçer"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 3: KISMİ GERİ YÜKLEME
  // ══════════════════════════════════════════════════════
  h1("3. KISMİ GERİ YÜKLEME"),

  h2("3.1 Ne Zaman Kısmi Geri Yükleme Gerekir?"),
  bullet("Yanlışlıkla silinen tek müşteri veya tek satış kurtarılmak isteniyor"),
  bullet("Fiyat toplu değiştirildi, sadece ürünler eski haline alınmak isteniyor"),
  bullet("Bir günlük satışlar silinmiş, sadece o gün geri yüklenecek"),
  bullet("Cari bakiye bozuldu, sadece cari tablosu yenilenmek isteniyor"),
  bullet("Tüm veriyi geri almak istenmiyor — sadece belirli kayıtlar"),
  spacer(),

  h2("3.2 Kısmi Geri Yükleme Çakışma Senaryoları"),
  infoBox("KRİTİK: Hiçbir tablo izole restore edilemez. Her kısmi geri yükleme cascading update gerektirir.", LIGHT_RED, RED),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2600, 6426],
    rows: [
      tableRow([{ text: "Kısmi geri yüklenen", w: 2600 }, { text: "Çakışma riski ve zorunlu cascade", w: 6426 }], true),
      tableRow([{ text: "sales geri yüklendi", w: 2600 }, { text: "stockMovements güncellenmedi → stok hatalı; Kasa güncellenmedi → nakit bakiye yanlış; Cari güncellenmedi → borç yanlış", w: 6426 }]),
      tableRow([{ text: "cari geri yüklendi", w: 2600, bg: LIGHT_GRAY }, { text: "Satışlar yeni cariId'ye referans verebilir → kırık link", w: 6426, bg: LIGHT_GRAY }]),
      tableRow([{ text: "products geri yüklendi", w: 2600 }, { text: "Eski fiyat geldi, mevcut satışlarda yeni fiyat var → maliyet tutarsız, WAC bozulur", w: 6426 }]),
      tableRow([{ text: "kasa geri yüklendi", w: 2600, bg: LIGHT_GRAY }, { text: "Hareket kaydı (kasaHareketleri) yeni ama bakiye eski → kalıcı fark oluşur", w: 6426, bg: LIGHT_GRAY }]),
      tableRow([{ text: "stockMovements geri yüklendi", w: 2600 }, { text: "products.stock ile çakışır, ikisi uyumsuz kalabilir", w: 6426 }]),
      tableRow([{ text: "installments geri yüklendi", w: 2600, bg: LIGHT_GRAY }, { text: "sales'daki ödeme tipi ile çelişebilir, cari çift sayım riski", w: 6426, bg: LIGHT_GRAY }]),
      tableRow([{ text: "bankTransactions geri yüklendi", w: 2600 }, { text: "Eşleştirme durumu (matched) uyumsuz kalabilir, kasa/cari çakışır", w: 6426 }]),
    ]
  }),
  spacer(),

  h2("3.3 Kısmi Geri Yükleme Arayüzü Gereksinimleri"),
  bullet("Yedek önizleme: 'Bu yedekte X satış, Y müşteri, Z ürün var — tarih: ...'"),
  bullet("Karşılaştırma: mevcut vs yedekteki kayıt sayısı gösterimi"),
  bullet("Seçim: tablo bazlı checkbox — hangilerini yüklemek istiyorsun?"),
  bullet("Çakışma uyarısı: 'Sales seçtiniz → kasa, stok, cari de etkilenecek, onaylıyor musunuz?'"),
  bullet("Conflict resolution: her çakışan kayıt için 'mevcut mu / yedekteki mi?' sorusu"),
  bullet("Önizleme modu: gerçekten yazmadan önce ne değişeceğini göster"),
  spacer(),

  h2("3.4 Tek Kayıt Kurtarma (En Sık İhtiyaç)"),
  para("Senaryo: 'Müşteri Ahmet'i yanlışlıkla sildim, sadece onu geri istiyorum'"),
  bullet("Yedek JSON'unu parse et, sadece o müşteriyi bul"),
  bullet("O müşteriye bağlı satışları kontrol et (çakışıyor mu?)"),
  bullet("Sadece o kaydı mevcut veriye ekle (merge)"),
  bullet("Müşterinin satışları hâlâ mevcut verinin sales tablosunda varsa → cariId linkini güncelle"),
  bullet("_activityLog'a 'manuel kurtarma' kaydı yaz (kim, ne zaman, hangi kayıt)"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 4: SATIŞ İŞLEMLERİ
  // ══════════════════════════════════════════════════════
  h1("4. SATIŞ İŞLEMLERİ"),

  h2("4.1 Satış Oluşturma — Atomik 5 Adım"),
  infoBox("Bir satış şu 5 işlemi aynı anda tamamlamalı. Ya hepsi ya hiçbiri — kısmi yazım durumu kabul edilemez.", LIGHT_RED, RED),
  spacer(),
  bullet("Adım 1 — sales tablosuna yaz (saleId benzersiz: sale_[timestamp]_[random4])"),
  bullet("Adım 2 — stockMovements → çıkış kaydı (ürün başına ayrı satır)"),
  bullet("Adım 3 — products.stock düş"),
  bullet("Adım 4 — Nakit ise: kasa artır + hareket kaydı (hangi kasaya gittiği: sale.kasaId)"),
  bullet("Adım 5 — Vadeli ise: cari.balance artır (borç)"),
  warnNote("Adım 3'te tarayıcı kapanırsa stok düşmüş ama kasa/cari güncellememiş olabilir. Tüm işlemi tek saveToStorage çağrısına sar, başarısız olursa rollback."),
  spacer(),

  h2("4.2 Satış Geri Alma (Soft Delete Cascade)"),
  infoBox("Satış silindiğinde sadece deleted=true yazmak yetmez. Aşağıdaki tüm adımlar cascade çalışmalı.", LIGHT_RED, RED),
  spacer(),
  bullet("sales.deleted = true + sales.deletedAt = now"),
  bullet("stockMovements → 'satis_iptali' tipinde giriş kaydı (negatif miktar değil, ayrı tip)"),
  bullet("products.stock geri ver"),
  bullet("Nakit satışsa: kasa düş + hareket kaydı ('satış iptali')"),
  bullet("Vadeli satışsa: cari.balance düş"),
  bullet("Taksit planı varsa: installments kayıtlarını iptal işaretle"),
  bullet("_activityLog'a 'satış iptal' yaz — kim, ne zaman, hangi satış, eski değerler"),
  warnNote("Kısmen ödenmiş taksitli satış iptalinde dikkat: ödenen taksitler kasa çıkışı gerektirebilir. Ödenmişleri iade et veya müşteri alacağına yaz."),
  spacer(),

  h2("4.3 Fiyat Düzeltme (Sonradan)"),
  bullet("YASAK: Direkt fiyat değiştirme → muhasebe geçmişini bozar"),
  bullet("Doğru yöntem 1: Satışı iptal et + yeni satış oluştur (tam geri alma)"),
  bullet("Doğru yöntem 2: Düzeltme farkı için ayrı 'fiyat düzeltme' kaydı (+/-)"),
  bullet("Fark cari'ye yansımalı (müşteri fazla ödediyse alacak, eksik ödediyse borç)"),
  bullet("Fark kasa'ya yansımalı (nakit satışsa)"),
  bullet("_activityLog: eski fiyat, yeni fiyat, düzeltme gerekçesi"),
  warnNote("Fiyat düzeltilirken stok etkilenmez — miktar aynı kaldı."),
  spacer(),

  h2("4.4 Miktar Düzeltme (Kısmi İade)"),
  para("Senaryo: 10 adet sattın, 2 adet iade geldi"),
  bullet("returns tablosuna yaz (saleId referansı ile)"),
  bullet("stockMovements → 'iade_girisi' tipi giriş kaydı (2 adet)"),
  bullet("products.stock artır (2 adet)"),
  bullet("İade bedeli ödenecekse: kasa çıkış + hareket"),
  bullet("Vadeli satıştaki iade: cari.balance düş (borç azalır)"),
  bullet("Satış kaydını güncelle: sales.returnedQty += 2"),
  bullet("Taksit planı varsa orantılı revize et"),
  spacer(),

  h2("4.5 Çift Satış / Duplicate Önleme"),
  bullet("Submit butonu: işlem süresince disabled"),
  bullet("Pending queue: aynı saleId tekrar gelirse işleme alma"),
  bullet("saleId formatı: sale_[timestamp]_[random4] — çakışma pratikte imkânsız"),
  bullet("LocalStorage yazılmadan önce: aynı ID var mı kontrol"),
  bullet("Hızlı satış modalı: kapanmadan önce 'kaydedildi mi?' kontrolü"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 5: CARİ + KASA
  // ══════════════════════════════════════════════════════
  h1("5. CARİ + KASA"),

  h2("5.1 Cari Bakiyeyi Etkileyen Tüm Kaynaklar"),
  para("Cari bakiye hesaplamasına dahil edilmesi gereken tüm işlem türleri:"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2800, 2100, 4126],
    rows: [
      tableRow([{ text: "Kaynak", w: 2800 }, { text: "Etki", w: 2100 }, { text: "Hangi modül", w: 4126 }], true),
      tableRow([{ text: "Vadeli satış", w: 2800 }, { text: "Borç artar (+)", w: 2100, color: RED }, { text: "Sales.tsx", w: 4126 }]),
      tableRow([{ text: "Nakit tahsilat (banka/kasa)", w: 2800, bg: LIGHT_GRAY }, { text: "Borç azalır (−)", w: 2100, bg: LIGHT_GRAY, color: GREEN }, { text: "Bank.tsx / Kasa.tsx", w: 4126, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Taksit ödemesi alındı", w: 2800 }, { text: "Borç azalır (−)", w: 2100, color: GREEN }, { text: "Installments", w: 4126 }]),
      tableRow([{ text: "İade yapıldı", w: 2800, bg: LIGHT_GRAY }, { text: "Borç azalır (−)", w: 2100, bg: LIGHT_GRAY, color: GREEN }, { text: "Returns", w: 4126, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Satış iptal edildi", w: 2800 }, { text: "Borç azalır (−)", w: 2100, color: GREEN }, { text: "Sales soft delete", w: 4126 }]),
      tableRow([{ text: "Fiyat düzeltme", w: 2800, bg: LIGHT_GRAY }, { text: "+/−", w: 2100, bg: LIGHT_GRAY }, { text: "Düzeltme kaydı", w: 4126, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Manuel düzeltme", w: 2800 }, { text: "+/−", w: 2100 }, { text: "Cari.tsx not alanı (bakiyeye etki ediliyorsa)", w: 4126 }]),
    ]
  }),
  spacer(),
  infoBox("Formül: Cari Bakiye = Σ borçlar − Σ ödemeler − Σ iadeler. Cari tablodaki balance alanı bu formülle her zaman doğrulanabilir olmalı.", LIGHT_GREEN, GREEN),
  spacer(),

  h2("5.2 Banka Hareketi Eşleştirme Tutarsızlıkları"),
  bullet("Banka transferi eşleştirildi → hem kasa artmalı hem cari azalmalı (atomik)"),
  bullet("Eşleştirme geri alınırsa: kasa düşmeli + cari artmalı (tam geri alma)"),
  bullet("Aynı banka hareketi iki kez eşleştirilirse: bankTransaction.matched = true ile önle"),
  bullet("Komisyon/EFT kesintisi: 1000₺ geldi ama 995₺ geçti → 5₺ fark bankFee alanına yazılmalı"),
  bullet("Toplu eşleştirmede bir tanesi hata verirse: diğerleri rollback mı devam mı? Kullanıcı seçmeli"),
  spacer(),

  h2("5.3 Çoklu Kasa Yönetimi"),
  bullet("Kasalar arası para transferi: her iki kasaya aynı anda yazılmalı (kasa1 −, kasa2 +)"),
  bullet("Genel toplam: Σ(kasalar.balance) — banka hesabı dahil mi değil mi ayarda belirtilmeli"),
  bullet("Bütçe raporu hangi kasaları baz alıyor? Tümü mü? Ayar gerekli"),
  bullet("Her satış hangi kasaya gittiği kaydedilmeli (sale.kasaId)"),
  bullet("Kasalar arası transfer _activityLog'a yazılmalı"),
  spacer(),

  h2("5.4 Cari Ekstre Edge Case'leri"),
  bullet("Ekstre export alınırken veri değişirse → snapshot alarak export et"),
  bullet("Not alanına yazılan manuel düzeltmeler bakiyeyi etkiliyor mu? Etkiliyorsa formül nerede?"),
  bullet("Silinen (deleted) müşterinin bakiyesi raporlara dahil mi?"),
  bullet("Müşteri adı değiştiğinde eski satışlardaki cariName alanı güncellenmeli mi?"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 6: STOK HAREKETLERİ
  // ══════════════════════════════════════════════════════
  h1("6. STOK HAREKETLERİ"),

  h2("6.1 stockMovements Kayıt Türleri — Eksiksiz Liste"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2400, 2600, 4026],
    rows: [
      tableRow([{ text: "Hareket tipi", w: 2400 }, { text: "Stok etkisi", w: 2600 }, { text: "Kaynak modül", w: 4026 }], true),
      tableRow([{ text: "satis_cikisi", w: 2400 }, { text: "− (düş)", w: 2600, color: RED }, { text: "Sales.tsx", w: 4026 }]),
      tableRow([{ text: "satis_iptali", w: 2400, bg: LIGHT_GRAY }, { text: "+ (geri ver)", w: 2600, bg: LIGHT_GRAY, color: GREEN }, { text: "Sales soft delete", w: 4026, bg: LIGHT_GRAY }]),
      tableRow([{ text: "iade_girisi", w: 2400 }, { text: "+ (geri ver)", w: 2600, color: GREEN }, { text: "Returns", w: 4026 }]),
      tableRow([{ text: "alim_girisi", w: 2400, bg: LIGHT_GRAY }, { text: "+ (artır)", w: 2600, bg: LIGHT_GRAY, color: GREEN }, { text: "orders / peletOrders / boruOrders", w: 4026, bg: LIGHT_GRAY }]),
      tableRow([{ text: "alim_iptali", w: 2400 }, { text: "− (düş)", w: 2600, color: RED }, { text: "Sipariş silme", w: 4026 }]),
      tableRow([{ text: "manuel_duzeltme", w: 2400, bg: LIGHT_GRAY }, { text: "+/−", w: 2600, bg: LIGHT_GRAY }, { text: "Fiziksel sayım farkı", w: 4026, bg: LIGHT_GRAY }]),
      tableRow([{ text: "zarar_fire", w: 2400 }, { text: "− (düş)", w: 2600, color: RED }, { text: "Hasar / kayıp kaydı", w: 4026 }]),
      tableRow([{ text: "baslangic_stok", w: 2400, bg: LIGHT_GRAY }, { text: "+ (ilk yükleme)", w: 2600, bg: LIGHT_GRAY, color: GREEN }, { text: "Yeni ürün oluşturma", w: 4026, bg: LIGHT_GRAY }]),
    ]
  }),
  spacer(),

  h2("6.2 Stok Bakiye Uyuşmazlığı Senaryoları"),
  bullet("products.stock ≠ Σ(stockMovements) → tutarsız veri. Her gün gece hesaplama ile kontrol edilmeli"),
  bullet("Yeni ürün eklendi ama başlangıç stok hareketi yazılmadı → stok 0 görünür, hareket geçmişi boş"),
  bullet("Toplu alım girildi, stockMovements ürün başına ayrı satır mı? Tek satırsa yanlış toplam"),
  bullet("Negatif stokla satış yapıldıysa stok kontrolü yoktu: fiziksel imkânsız durum oluşur"),
  bullet("'Daha fazla yükle' butonu: stok hareketleri sayfalanıyorsa toplam hesaplamada tümü alınıyor mu?"),
  spacer(),

  h2("6.3 Ağırlıklı Ortalama Maliyet (WAC) Tetikleyicileri"),
  infoBox("WAC hesabı tüm alım tablolarını (orders, peletOrders, boruOrders) birleştirerek çalışmalı. Tek tabloyu baz alan hesap hatalı WAC üretir.", LIGHT_AMBER, AMBER),
  spacer(),
  bullet("Yeni alım girildi → newWAC = (mevcutStok × eskiWAC + alımMiktar × alımFiyat) / (mevcutStok + alımMiktar)"),
  bullet("Alım iptal edildi → WAC geri hesaplanmalı (önceki değere dönüş veya yeniden hesap)"),
  bullet("Alım fiyatı sonradan düzeltildi → WAC güncellenmelidir"),
  bullet("İade girişi WAC'ı etkilemez — iade orijinal maliyetle döner"),
  bullet("Stok sıfırlandığında WAC → son bilinen değeri koru (sıfıra bölme hatası önle)"),
  spacer(),

  h2("6.4 Fiziksel Sayım — Sistem Farkı Yönetimi"),
  bullet("Fark +ise (sistemde az görünüyor): 'sayim_fazlasi' hareketi → stok artır"),
  bullet("Fark −ise (sistemde çok görünüyor): 'fire_sayim_eksigi' hareketi → stok düş + gider yaz"),
  bullet("Bu düzeltmeler stockMovements'a 'manuel_sayim' tipiyle kayıt edilmeli"),
  bullet("Düzeltme tarihi ve açıklaması zorunlu (_activityLog'a da yazılmalı)"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 7: SİLME VE DÜZELTME
  // ══════════════════════════════════════════════════════
  h1("7. SİLME, DÜZELTME VE GÜNCELLEME"),

  h2("7.1 Soft Delete Cascade Tablosu"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2400, 6626],
    rows: [
      tableRow([{ text: "Silinen kayıt", w: 2400 }, { text: "Zorunlu cascade işlemleri", w: 6626 }], true),
      tableRow([{ text: "Satış silindi", w: 2400 }, { text: "Stok geri ver, kasa geri al, cari borç düş, installments iptal et", w: 6626 }]),
      tableRow([{ text: "Müşteri silindi", w: 2400, bg: LIGHT_GRAY }, { text: "Satışlar orphan kalır → kullanıcıyı uyar veya engelle", w: 6626, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Ürün silindi", w: 2400 }, { text: "Mevcut satışlardaki görünüm etkilenmemeli (tarihsel veri korunmalı)", w: 6626 }]),
      tableRow([{ text: "Tedarikçi silindi", w: 2400, bg: LIGHT_GRAY }, { text: "Alımlar ve WAC geçmişi korunmalı", w: 6626, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Kasa silindi", w: 2400 }, { text: "O kasaya bağlı hareketler ne olacak? → Bloke et", w: 6626 }]),
      tableRow([{ text: "Banka hareketi silindi", w: 2400, bg: LIGHT_GRAY }, { text: "Eşleştirme varsa: cari + kasa geri al", w: 6626, bg: LIGHT_GRAY }]),
      tableRow([{ text: "Taksit planı silindi", w: 2400 }, { text: "Ödenenler kasada kalsın; ödenmeyenler için cari ne olacak?", w: 6626 }]),
      tableRow([{ text: "İade kaydı silindi", w: 2400, bg: LIGHT_GRAY }, { text: "Stok tekrar düş, cari tekrar artır, kasa iade geri al", w: 6626, bg: LIGHT_GRAY }]),
    ]
  }),
  spacer(),

  h2("7.2 Geçmişe Dönük Düzeltme Riskleri"),
  bullet("Eski satışın fiyatını değiştirme → o dönem kar/zarar raporunu bozar → YASAK, sadece düzeltme farkı kaydı kabul"),
  bullet("Tarih değiştirme → dönem raporlarını bozar → izin ver ama _activityLog'a yaz"),
  bullet("Müşteri değiştirme → eski cari −, yeni cari +, atomik işlem"),
  bullet("Ödeme tipi değiştirme ('nakit' → 'vadeli') → kasa geri al + cari borç ekle veya tam tersi"),
  bullet("Miktar değiştirme → stok, kasa, cari farkı güncellenmeli"),
  spacer(),

  h2("7.3 Toplu İşlem Güvenliği"),
  bullet("Toplu fiyat güncellemesi: önce yedek al, sonra uygula"),
  bullet("Toplu müşteri birleştirme (duplicate merge): eski müşterinin tüm satışları yeniye taşınmalı, bakiye birleşmeli"),
  bullet("Toplu silme: 50 satış sil → her biri için cascade çalışmalı, toplu rollback desteklenmeli"),
  bullet("Toplu işlem ilerleme göstergesi: kaç tane işlendi, kaç hata var"),
  bullet("Kısmi başarısız toplu işlem: başarılı olanlar kalır mı tümü geri alınır mı → kullanıcı seçmeli"),
  spacer(),

  h2("7.4 Kullanıcı Hatası Önleme (UX)"),
  bullet("Silme onay dialogu: 'Bu satış ve ilgili kasa/stok/cari hareketleri iptal edilecek. Onaylıyor musunuz?'"),
  bullet("Kritik silmelerden önce otomatik mini snapshot"),
  bullet("Son N işlem geri alınabilir — undo stack (en az 10 işlem)"),
  bullet("Düzeltme inputları için orijinal değer göster (placeholder veya tooltip)"),
  bullet("_activityLog: her değişiklikte kim, ne, ne zaman, eski değer, yeni değer"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 8: ERP UYGUNLUK DEĞERLENDİRMESİ
  // ══════════════════════════════════════════════════════
  h1("8. ERP UYGUNLUK DEĞERLENDİRMESİ"),

  h2("8.1 Mevcut Durum Özeti"),
  spacer(),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3800, 2600, 2626],
    rows: [
      tableRow([{ text: "ERP Kriteri", w: 3800 }, { text: "Mevcut Durum", w: 2600 }, { text: "Öncelik", w: 2626 }], true),
      tableRow([{ text: "Çift taraflı kayıt (double-entry)", w: 3800 }, { text: "YOK", w: 2600, color: RED, bold: true }, { text: "Kritik eksik", w: 2626, color: RED }]),
      tableRow([{ text: "Dönem kapatma", w: 3800, bg: LIGHT_GRAY }, { text: "YOK", w: 2600, bg: LIGHT_GRAY, color: RED, bold: true }, { text: "Kritik eksik", w: 2626, bg: LIGHT_GRAY, color: RED }]),
      tableRow([{ text: "Atomik işlem garantisi", w: 3800 }, { text: "KISMİ", w: 2600, color: AMBER, bold: true }, { text: "Geliştirilmeli", w: 2626, color: AMBER }]),
      tableRow([{ text: "Denetim izi (_activityLog)", w: 3800, bg: LIGHT_GRAY }, { text: "VAR", w: 2600, bg: LIGHT_GRAY, color: GREEN, bold: true }, { text: "Yeterli", w: 2626, bg: LIGHT_GRAY, color: GREEN }]),
      tableRow([{ text: "Stok hareket defteri", w: 3800 }, { text: "VAR", w: 2600, color: GREEN, bold: true }, { text: "Yeterli", w: 2626, color: GREEN }]),
      tableRow([{ text: "Cari hesap mutabakatı", w: 3800, bg: LIGHT_GRAY }, { text: "MANUEL", w: 2600, bg: LIGHT_GRAY, color: AMBER, bold: true }, { text: "Otomasyona alınmalı", w: 2626, bg: LIGHT_GRAY, color: AMBER }]),
      tableRow([{ text: "Vergi/KDV hesabı", w: 3800 }, { text: "BELİRSİZ", w: 2600, color: AMBER, bold: true }, { text: "Tanımlanmalı", w: 2626, color: AMBER }]),
      tableRow([{ text: "Çoklu para birimi", w: 3800, bg: LIGHT_GRAY }, { text: "KAPSAM DIŞI", w: 2600, bg: LIGHT_GRAY, color: GRAY, bold: true }, { text: "Şimdilik gerek yok", w: 2626, bg: LIGHT_GRAY, color: GRAY }]),
    ]
  }),
  spacer(),

  h2("8.2 Pratik ERP Çözüm Önerileri"),
  bullet("Double-entry tam şart değil — her kasa/cari hareketine kaynak referansı (saleId / bankTransactionId / orderId) eklenirse izlenebilirlik sağlanır"),
  bullet("Dönem kilitleme: basit 'dönemi kilitle' butonu + kilitli dönemde write yasağı yeterli başlangıç"),
  bullet("WAC yöntemi settings'e kayıt edilmeli, tüm hesaplamalarda tek yöntem kullanılmalı"),
  bullet("KDV: her ürüne KDV oranı alanı + satış kaydında brüt/net ayrımı"),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 9: ATLANMIŞ RİSKLER
  // ══════════════════════════════════════════════════════
  h1("9. ATLANMIŞ / GÖZDENİ KAÇAN RİSKLER"),

  h2("9.1 Teknik Altyapı Riskleri"),
  spacer(),
  riskPara("KRİTİK", RED, "localStorage dolma (QuotaExceededError)", "5MB sınırı. Büyük veri + yedek birlikte saklanınca dolabilir. Yazma başarısız olunca ses çıkmadan veri kaybı yaşanır."),
  fixNote("try-catch ile QuotaExceededError yakala, eski yedekleri temizle, kullanıcıya 'depolama doldu' bildirimi ver."),
  spacer(),
  riskPara("KRİTİK", RED, "Tarayıcı yenilenirken yarım kalan işlem", "saveToStorage çağrısı sırasında sayfa yenilenirse: kasa güncellendi ama cari güncellenmedi durumu oluşabilir."),
  fixNote("beforeunload → dirty flag → sayfa açılışında flag kontrolü + reconciliation."),
  spacer(),
  riskPara("YÜKSEK", AMBER, "Vercel deployment sırasında veri erişimi", "Yeni deploy push edilirken kullanıcı aktif kullanımdaysa: eski JS + yeni schema uyumsuzluğu oluşabilir."),
  fixNote("Deploy sonrası service worker cache temizle, _schemaVersion ile schema versiyonunu kontrol et."),
  spacer(),
  riskPara("YÜKSEK", AMBER, "iPhone / iOS Safari bellek temizliği", "Uygulama arka plana alınınca Safari sekme belleğini temizleyebilir. Yarım kalan işlem ve form verisi kaybolur."),
  fixNote("Form verilerini debounce ile localStorage draft'a kaydet; açılışta draft varsa 'devam mı?' sorusu."),
  spacer(),

  h2("9.2 İş Mantığı Riskleri"),
  spacer(),
  riskPara("YÜKSEK", AMBER, "similarity.ts yanlış müşteri eşleştirmesi", "'Ali Kaya' ve 'Halil Kaya' %80+ benzerlikte otomatik eşleşebilir. Farklı müşterinin ödemesi yanlış cariye gidebilir."),
  fixNote("Eşleştirme skoru eşiğini %90+'a yükselt veya %80-95 arası manuel onay gerektir."),
  spacer(),
  riskPara("YÜKSEK", AMBER, "peletOrders / boruOrders ayrı tablo — WAC bütünlüğü", "WAC hesabı sadece orders tablosunu görüyorsa pelet/boru alımları hesaba katılmaz, maliyet hatalı olur."),
  fixNote("WAC hesabı tüm alım tablolarını birleştirerek çalışmalı."),
  spacer(),
  riskPara("ORTA", BLUE, "AI Asistanı'nın veri değiştirip değiştirmediği", "AIAsistan.tsx önerilen işlemleri doğrudan yazabiliyorsa kullanıcı fark etmeden veri değişebilir."),
  fixNote("AI eylemleri kullanıcı onayı olmadan yazmamalı — 'şunu yapayım mı?' onay modeli."),
  spacer(),
  riskPara("ORTA", BLUE, "Reports.tsx Excel export sırasında veri değişimi", "Export alınırken veri değişirse tutarsız satırlar oluşabilir."),
  fixNote("Export başlangıcında veri snapshot'ını al, export boyunca onu kullan."),
  spacer(),
  riskPara("ORTA", BLUE, "Dönem kapatma yokluğu", "Geçmiş ayların verisi hâlâ değiştirilebilir. Mali müşavire götürmeden önce ay sonu bakiyesi değişirse problem çıkar."),
  fixNote("Basit 'dönemi kilitle' butonu + kilitli dönemde write yasağı."),
  spacer(),
  riskPara("ORTA", BLUE, "Çoklu cihaz senkronizasyon çakışması", "Telefon + bilgisayar aynı anda kullanılırsa localStorage izole. Birini diğerine import etmek veri üzerine yazar."),
  fixNote("Merge stratejisi: timestamp bazlı 'son değiştiren kazanır' veya Supabase'e geçiş."),

  pageBreak(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 10: KONTROL LİSTELERİ
  // ══════════════════════════════════════════════════════
  h1("10. KONTROL LİSTELERİ"),

  h2("10.1 Her Satış İşleminde"),
  bullet("Müşteri seçimi → carisi var mı / misafir mi?"),
  bullet("Ürün stok yeterliliği kontrol (satış miktarı < mevcut stok)"),
  bullet("Ödeme tipi: nakit / vadeli / taksit ayrımı net mi?"),
  bullet("Nakit ise: hangi kasaya girdi? (sale.kasaId)"),
  bullet("Vadeli ise: cari borç yaratıldı mı?"),
  bullet("Stok düşüldü mü? (stockMovements kaydı var mı?)"),
  bullet("saleId benzersiz + çift kayıt önlendi mi?"),
  bullet("_activityLog'a yazıldı mı?"),
  bullet("Maliyet hesaplandı mı? (WAC — tüm alım tabloları dahil)"),
  bullet("Taksit varsa: plan oluşturuldu mu, cari ile çakışıyor mu?"),
  spacer(),

  h2("10.2 Her Banka Hareketi Eşleştirmesinde"),
  bullet("Eşleşen müşteri / tedarikçi doğru belirlendi mi?"),
  bullet("Tutar tam mı? Komisyon/kesinti var mı? (bankFee alanı)"),
  bullet("Kasa + cari güncelleme atomik mi? (ikisi de ya olur ya olmaz)"),
  bullet("Eşleştirme geri alınabilir mi? (undo mekanizması)"),
  bullet("Çift eşleştirme önlendi mi? (bankTransaction.matched = true kontrolü)"),
  spacer(),

  h2("10.3 Her Geri Yükleme Öncesinde"),
  bullet("Checksum doğrulandı mı?"),
  bullet("_schemaVersion uyumlu mu?"),
  bullet("Mevcut verinin yedeği alındı mı? (yükleme öncesi otomatik snapshot)"),
  bullet("Hangi tablolar yüklenecek belirlendi mi?"),
  bullet("Referans bütünlüğü kontrolü planlandı mı?"),
  bullet("Bakiye reconciliation yapılacak mı?"),
  spacer(),

  h2("10.4 Dönem Sonu Kontrol"),
  bullet("Kasa bakiyesi = banka ekstresindeki bakiye mi?"),
  bullet("Cari bakiyelerin toplamı = açık alacaklar mı?"),
  bullet("Stok sayımı = sistemdeki stok mu?"),
  bullet("Eşleştirilmemiş banka hareketi kaldı mı?"),
  bullet("Soft delete edilmiş satışların stok etkisi geri alındı mı?"),
  bullet("stockMovements toplamı products.stock ile uyuşuyor mu?"),
  bullet("WAC değerleri son alımlardan sonra güncellendi mi?"),
  spacer(),

  // ══════════════════════════════════════════════════════
  // BÖLÜM 11: ÖNCELİK SIRASI
  // ══════════════════════════════════════════════════════
  h1("11. GELİŞTİRME ÖNCELİK SIRASI"),

  h2("Faz 1 — Kritik (Hemen)"),
  bullet("Satış atomikliği: 5 adım tek saveToStorage çağrısına alınsın"),
  bullet("Soft delete cascade: stok + kasa + cari + installments geri alma"),
  bullet("Bank.tsx → cari propagation: eşleştirme sonrası cari güncelleme zorunlu"),
  bullet("QuotaExceededError yakalama + kullanıcı bildirimi"),
  bullet("Checksum'lu yedek formatı + geri yükleme doğrulama"),
  spacer(),

  h2("Faz 2 — Yüksek (Bu Ay)"),
  bullet("Kısmi geri yükleme arayüzü + çakışma uyarıları"),
  bullet("Reconciliation: geri yükleme sonrası bakiye karşılaştırma"),
  bullet("WAC hesabı tüm alım tablolarını kapsayacak şekilde güncelle"),
  bullet("similarity.ts eşleştirme eşiğini %90+'a yükselt"),
  bullet("dirty flag + beforeunload snapshot"),
  spacer(),

  h2("Faz 3 — Orta (Sonraki Ay)"),
  bullet("Undo stack (son 10 işlem geri alınabilir)"),
  bullet("Dönem kilitleme (basit versiyon)"),
  bullet("AI asistanı için onay modeli"),
  bullet("Export snapshot alarak çalışma"),
  bullet("_activityLog'u eski değer + yeni değer içerecek şekilde genişlet"),
  spacer(),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: HEADER_BG } },
    children: [new TextRun({ text: "Soba Yönetim Sistemi — Senaryo Planı v1.0 — Nisan 2026", font: "Arial", size: 17, color: GRAY })]
  }),
];

// ─── DOCUMENT ──────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } }
        }]
      },
      {
        reference: "bullets2",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "◦",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 240 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: HEADER_BG },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
      }
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/mnt/user-data/outputs/Soba_Senaryo_Plani.docx', buf);
  console.log('OK');
}).catch(e => { console.error(e); process.exit(1); });
