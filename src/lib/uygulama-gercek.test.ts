/**
 * 🏪 Gerçek Uygulama Entegrasyon Testleri
 *
 * Tam iş günü senaryosu: açılış → satışlar → tedarik ödemesi → tahsilat → kapanış.
 * Pattern: prevDB → işlem → nextDB, rule engine her adımda çalışır.
 */

import type {
  Cari,
  DB,
  KasaEntry,
  Product,
  Sale,
  StockMovement,
} from "@/types";
import { describe, expect, it } from "vitest";
import { validateTransaction } from "./ruleEngine";

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function genId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function now(): string {
  return new Date().toISOString();
}

function makeDB(overrides: Partial<DB> = {}): DB {
  return {
    _version: 1,
    products: [],
    sales: [],
    suppliers: [],
    orders: [],
    cari: [],
    kasa: [],
    kasalar: [
      { id: "nakit", name: "Nakit", icon: "💵" },
      { id: "banka", name: "Banka", icon: "🏦" },
      { id: "pos", name: "POS", icon: "💳" },
    ],
    bankTransactions: [],
    matchRules: [],
    monitorRules: [],
    monitorLog: [],
    stockMovements: [],
    peletSuppliers: [],
    peletOrders: [],
    boruSuppliers: [],
    boruOrders: [],
    invoices: [],
    budgets: [],
    returns: [],
    _activityLog: [],
    _auditLog: [],
    company: { id: "c1", createdAt: now() },
    settings: {},
    pelletSettings: { gramaj: 14, kgFiyat: 6.5, cuvalKg: 15, critDays: 3 },
    ortakEmanetler: [],
    installments: [],
    partners: [],
    productCategories: [],
    notes: [],
    ...overrides,
  };
}

function makeProduct(
  id: string,
  name: string,
  stock: number,
  price: number,
  cost: number,
  category = "soba",
): Product {
  return {
    id,
    name,
    category,
    cost,
    price,
    stock,
    minStock: 2,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

function makeCari(id: string, name: string, balance = 0): Cari {
  return {
    id,
    name,
    type: "musteri",
    balance,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

/** Nakit / kart / banka satışı simüle eder */
function satisYap(
  prevDB: DB,
  productId: string,
  adet: number,
  odeme: "nakit" | "banka" | "pos",
): {
  nextDB: DB;
  violations: ReturnType<typeof validateTransaction>;
  saleId: string;
} {
  const product = prevDB.products.find((p) => p.id === productId)!;
  const saleId = genId();
  const nowIso = now();
  const total = product.price * adet;
  const profit = (product.price - product.cost) * adet;

  const sale: Sale = {
    id: saleId,
    productId: product.id,
    productName: product.name,
    productCategory: product.category,
    quantity: adet,
    unitPrice: product.price,
    cost: product.cost,
    discount: 0,
    discountAmount: 0,
    subtotal: total,
    total,
    profit,
    payment: odeme,
    status: "tamamlandi",
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: adet,
        unitPrice: product.price,
        cost: product.cost,
        total,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const kasaEntry: KasaEntry = {
    id: genId(),
    type: "gelir",
    category: "satis",
    amount: total,
    kasa: odeme,
    description: `Satış: ${product.name} x${adet}`,
    relatedId: saleId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const stokHareket: StockMovement = {
    id: genId(),
    productId: product.id,
    productName: product.name,
    type: "satis",
    amount: -adet,
    before: product.stock,
    after: product.stock - adet,
    note: `Satış x${adet}`,
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    sales: [...prevDB.sales, sale],
    products: prevDB.products.map((p) =>
      p.id === productId
        ? { ...p, stock: p.stock - adet, updatedAt: nowIso }
        : p,
    ),
    kasa: [...prevDB.kasa, kasaEntry],
    stockMovements: [...prevDB.stockMovements, stokHareket],
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

/** Cari (veresiye) satış simüle eder */
function cariSatisYap(
  prevDB: DB,
  productId: string,
  adet: number,
  cariId: string,
): {
  nextDB: DB;
  violations: ReturnType<typeof validateTransaction>;
  saleId: string;
} {
  const product = prevDB.products.find((p) => p.id === productId)!;
  const saleId = genId();
  const nowIso = now();
  const total = product.price * adet;
  const profit = (product.price - product.cost) * adet;

  const sale: Sale = {
    id: saleId,
    productId: product.id,
    productName: product.name,
    productCategory: product.category,
    cariId,
    cariName: prevDB.cari.find((c) => c.id === cariId)?.name,
    quantity: adet,
    unitPrice: product.price,
    cost: product.cost,
    discount: 0,
    discountAmount: 0,
    subtotal: total,
    total,
    profit,
    payment: "cari",
    status: "tamamlandi",
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: adet,
        unitPrice: product.price,
        cost: product.cost,
        total,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const stokHareket: StockMovement = {
    id: genId(),
    productId: product.id,
    productName: product.name,
    type: "satis",
    amount: -adet,
    before: product.stock,
    after: product.stock - adet,
    note: `Cari satış x${adet}`,
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    sales: [...prevDB.sales, sale],
    products: prevDB.products.map((p) =>
      p.id === productId
        ? { ...p, stock: p.stock - adet, updatedAt: nowIso }
        : p,
    ),
    kasa: prevDB.kasa, // cari satışta kasaya nakit girmez
    stockMovements: [...prevDB.stockMovements, stokHareket],
    cari: prevDB.cari.map((c) =>
      c.id === cariId
        ? {
            ...c,
            balance: (c.balance || 0) + total,
            lastTransaction: nowIso,
            updatedAt: nowIso,
          }
        : c,
    ),
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

/** Tahsilat simüle eder (cari bakiyesini düşürür, kasaya nakit girer) */
function tahsilatYap(
  prevDB: DB,
  cariId: string,
  amount: number,
  kasa: "nakit" | "banka",
): { nextDB: DB; violations: ReturnType<typeof validateTransaction> } {
  const nowIso = now();

  const kasaEntry: KasaEntry = {
    id: genId(),
    type: "gelir",
    category: "tahsilat",
    amount,
    kasa,
    description: `Tahsilat: ${prevDB.cari.find((c) => c.id === cariId)?.name || cariId}`,
    cariId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
    cari: prevDB.cari.map((c) =>
      c.id === cariId
        ? {
            ...c,
            balance: (c.balance || 0) - amount,
            lastTransaction: nowIso,
            updatedAt: nowIso,
          }
        : c,
    ),
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

/** Gider kaydı simüle eder (kira, elektrik, tedarikçi ödemesi vb.) */
function giderEkle(
  prevDB: DB,
  amount: number,
  kasa: "nakit" | "banka",
  aciklama: string,
): { nextDB: DB; violations: ReturnType<typeof validateTransaction> } {
  const nowIso = now();

  const kasaEntry: KasaEntry = {
    id: genId(),
    type: "gider",
    category: "genel",
    amount,
    kasa,
    description: aciklama,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

// ─── Yardımcı: Kasa bakiyesi hesapla ─────────────────────────────────────────

function kasaBakiyesi(db: DB, kasaId: string): number {
  return db.kasa
    .filter((k) => !k.deleted && k.kasa === kasaId)
    .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
}

// ─── TESTLER ──────────────────────────────────────────────────────────────────

describe("🏪 Gerçek Uygulama Entegrasyon Testleri", () => {
  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 1: Tam İş Günü Akışı
  // ══════════════════════════════════════════════════════════════════════════

  describe("Senaryo 1: Tam iş günü — açılış → satışlar → tahsilat → kapanış", () => {
    // Başlangıç: 30 soba (1.200 ₺/ad), nakit kasada 5.000 ₺ açılış bakiyesi
    const soba = makeProduct("soba-001", "Standart Soba", 30, 1_200, 800);
    const musteri = makeCari("cari-001", "Mehmet Demir", 0);

    // Açılış kasası
    const acilisKasaEntry: KasaEntry = {
      id: "acilis-001",
      type: "gelir",
      category: "acilis",
      amount: 5_000,
      kasa: "nakit",
      description: "Gün başı açılış bakiyesi",
      createdAt: now(),
      updatedAt: now(),
    };

    let db = makeDB({
      products: [soba],
      cari: [musteri],
      kasa: [acilisKasaEntry],
    });

    // Sabah: 3 nakit soba satışı
    const violations: ReturnType<typeof validateTransaction> = [];

    const sabahSatis1 = satisYap(db, "soba-001", 2, "nakit");
    violations.push(...sabahSatis1.violations);
    db = sabahSatis1.nextDB;

    const sabahSatis2 = satisYap(db, "soba-001", 1, "banka");
    violations.push(...sabahSatis2.violations);
    db = sabahSatis2.nextDB;

    // Öğlen: Cari satış (5 soba veresiye)
    const oglenSatis = cariSatisYap(db, "soba-001", 5, "cari-001");
    violations.push(...oglenSatis.violations);
    db = oglenSatis.nextDB;

    // Öğle arası: elektrik faturası gideri
    const gider1 = giderEkle(db, 1_500, "nakit", "Elektrik faturası");
    violations.push(...gider1.violations);
    db = gider1.nextDB;

    // Akşam: Tahsilat (Mehmet Demir 3.000 ₺ ödüyor)
    const tahsilat1 = tahsilatYap(db, "cari-001", 3_000, "nakit");
    violations.push(...tahsilat1.violations);
    db = tahsilat1.nextDB;

    // Son pos satışı
    const aksamSatis = satisYap(db, "soba-001", 1, "pos");
    violations.push(...aksamSatis.violations);
    db = aksamSatis.nextDB;

    it("gün boyunca kural ihlali olmamalı", () => {
      expect(violations).toHaveLength(0);
    });

    it("toplam satış adedi 9 olmalı (2+1+5+1)", () => {
      expect(db.sales).toHaveLength(4); // 4 satış işlemi
      const toplamAdet = db.sales.reduce((s, sale) => s + sale.quantity, 0);
      expect(toplamAdet).toBe(9);
    });

    it("stok 30 → 21 olmalı (9 soba satıldı)", () => {
      const s = db.products.find((p) => p.id === "soba-001")!;
      expect(s.stock).toBe(21);
    });

    it("nakit kasa: 5000 + 2400 - 1500 + 3000 = 8900 ₺", () => {
      // acilis: +5000, sabahSatis1 (2×1200=2400): +2400, gider1: -1500, tahsilat1: +3000
      expect(kasaBakiyesi(db, "nakit")).toBe(8_900);
    });

    it("banka kasa: sabahSatis2 (1200) = 1200 ₺", () => {
      expect(kasaBakiyesi(db, "banka")).toBe(1_200);
    });

    it("pos kasa: aksamSatis (1200) = 1200 ₺", () => {
      expect(kasaBakiyesi(db, "pos")).toBe(1_200);
    });

    it("cari bakiyesi: 6000 (5 soba veresiye) - 3000 (tahsilat) = 3000 ₺", () => {
      const cari = db.cari.find((c) => c.id === "cari-001")!;
      expect(cari.balance).toBe(3_000);
    });

    it("stok hareketleri 4 kayıt içermeli (her satış için 1)", () => {
      expect(db.stockMovements).toHaveLength(4);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 2: Yetersiz kasa bakiyesi ile gider ekleme engeli
  // ══════════════════════════════════════════════════════════════════════════

  describe("Senaryo 2: Kasa bakiyesi yetersizken gider ekleme engellenir", () => {
    // Kasada sadece 500 ₺ var, 1000 ₺ gider girilmeye çalışılıyor
    const acilisKasa: KasaEntry = {
      id: "acilis-002",
      type: "gelir",
      category: "acilis",
      amount: 500,
      kasa: "nakit",
      description: "Açılış",
      createdAt: now(),
      updatedAt: now(),
    };
    const db0 = makeDB({ kasa: [acilisKasa] });

    const { violations } = giderEkle(db0, 1_000, "nakit", "Kira ödemesi");

    it("negative_kasa ihlali üretmeli", () => {
      expect(violations.some((v) => v.ruleId === "negative_kasa")).toBe(true);
    });

    it("ihlal severity block olmalı", () => {
      const v = violations.find((v) => v.ruleId === "negative_kasa")!;
      expect(v.severity).toBe("block");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 3: Çoklu ürün satışı ve stok tutarlılığı
  // ══════════════════════════════════════════════════════════════════════════

  describe("Senaryo 3: İki farklı ürün, bağımsız stok takibi", () => {
    const boru = makeProduct(
      "boru-001",
      "Baca Borusu",
      50,
      200,
      120,
      "aksesuar",
    );
    const soba = makeProduct("soba-002", "Lüks Soba", 10, 3_000, 2_000);
    let db = makeDB({ products: [boru, soba] });

    const s1 = satisYap(db, "boru-001", 10, "nakit");
    db = s1.nextDB;
    const s2 = satisYap(db, "soba-002", 3, "banka");
    db = s2.nextDB;

    it("boru stok 50 → 40 olmalı", () => {
      expect(db.products.find((p) => p.id === "boru-001")!.stock).toBe(40);
    });

    it("soba stok 10 → 7 olmalı", () => {
      expect(db.products.find((p) => p.id === "soba-002")!.stock).toBe(7);
    });

    it("nakit kasada 10 × 200 = 2000 ₺ olmalı", () => {
      expect(kasaBakiyesi(db, "nakit")).toBe(2_000);
    });

    it("banka kasada 3 × 3000 = 9000 ₺ olmalı", () => {
      expect(kasaBakiyesi(db, "banka")).toBe(9_000);
    });

    it("toplam kâr: (10×80) + (3×1000) = 800 + 3000 = 3800 ₺", () => {
      const toplamKar = db.sales.reduce((s, sale) => s + sale.profit, 0);
      expect(toplamKar).toBe(3_800);
    });

    it("iki ayrı satış için kural ihlali olmamalı", () => {
      expect([...s1.violations, ...s2.violations]).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 4: Ardışık tahsilat akışı — cari bakiye sıfıra iner
  // ══════════════════════════════════════════════════════════════════════════

  describe("Senaryo 4: Cari satış → kısmi tahsilatlar → sıfır bakiye", () => {
    const soba = makeProduct("soba-001", "Standart Soba", 20, 1_200, 800);
    const musteri = makeCari("cari-001", "Ali Veli", 0);
    let db = makeDB({ products: [soba], cari: [musteri] });

    // 5 soba veresiye: bakiye = 6000
    const satis = cariSatisYap(db, "soba-001", 5, "cari-001");
    db = satis.nextDB;

    // 3 farklı tutarda tahsilat: 3000 + 2000 + 1000 = 6000
    const t1 = tahsilatYap(db, "cari-001", 3_000, "nakit");
    db = t1.nextDB;

    const t2 = tahsilatYap(db, "cari-001", 2_000, "nakit");
    db = t2.nextDB;

    const t3 = tahsilatYap(db, "cari-001", 1_000, "nakit");
    db = t3.nextDB;

    it("tüm işlemler kural ihlalsiz tamamlanmalı", () => {
      const allViolations = [
        ...satis.violations,
        ...t1.violations,
        ...t2.violations,
        ...t3.violations,
      ];
      expect(allViolations).toHaveLength(0);
    });

    it("cari bakiyesi 0 olmalı (6000 - 3000 - 2000 - 1000 = 0)", () => {
      const cari = db.cari.find((c) => c.id === "cari-001")!;
      expect(cari.balance).toBe(0);
    });

    it("nakit kasaya 3000+2000+1000 = 6000 ₺ tahsilat girmiş olmalı", () => {
      expect(kasaBakiyesi(db, "nakit")).toBe(6_000);
    });
  });
});
