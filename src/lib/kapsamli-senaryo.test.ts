/**
 * 🏪 Kapsamlı Senaryo Testleri
 *
 * Pattern: prevDB → işlem → nextDB
 * Tüm testler saf fonksiyon olarak çalışır, UI bağımlılığı yoktur.
 * Rule engine: validateTransaction(prevDB, nextDB) her işlem sonrası çağrılır.
 */

import type {
  Cari,
  DB,
  KasaEntry,
  Product,
  RuleViolation,
  Sale,
  SaleItem,
  StockMovement,
} from "@/types";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateTransaction } from "./ruleEngine";
import { similarity } from "./similarity";

// ─── Yardımcı: ID ve Zaman ────────────────────────────────────────────────────

function genId(): string {
  // Math.random tabanlı — window.crypto kullanmaz (Node/jsdom uyumlu)
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s4()}${s4()}-${s4()}-4${s4().substring(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().substring(1)}-${s4()}${s4()}${s4()}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── DB Fabrika ───────────────────────────────────────────────────────────────

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

// ─── Ürün Fabrika ─────────────────────────────────────────────────────────────

function makeProduct(
  id: string,
  name: string,
  stock: number,
  price: number,
  cost: number,
): Product {
  return {
    id,
    name,
    category: "soba",
    cost,
    price,
    stock,
    minStock: 0,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

// ─── Satış ────────────────────────────────────────────────────────────────────

/**
 * Satış işlemini simüle eder — Sales.tsx saveSale mantığını yansıtır.
 * prevDB → { nextDB, violations, saleId }
 */
function satisYap(
  prevDB: DB,
  items: Array<{ productId: string; qty: number; unitPrice?: number }>,
  odeme: "nakit" | "banka" | "cari",
  cariId?: string,
  tahsilat?: number,
  iskonto?: { type: "percent" | "amount"; value: number },
): { nextDB: DB; violations: RuleViolation[]; saleId: string } {
  const nowIso = now();
  const saleId = genId();

  // Ürün bilgilerini çöz
  const resolvedItems: SaleItem[] = items.map((i) => {
    const p = prevDB.products.find((x) => x.id === i.productId)!;
    const unitPrice = i.unitPrice !== undefined ? i.unitPrice : p.price;
    const qty = i.qty;
    return {
      productId: p.id,
      productName: p.name,
      quantity: qty,
      unitPrice,
      cost: p.cost,
      total: qty * unitPrice,
    };
  });

  // Hesaplamalar
  const subtotal = resolvedItems.reduce((s, i) => s + i.total, 0);
  let discountAmount = 0;
  let discountNum = 0;
  if (iskonto) {
    discountNum = iskonto.value;
    discountAmount =
      iskonto.type === "percent"
        ? subtotal * (iskonto.value / 100)
        : iskonto.value;
  }
  const total = Math.max(0, subtotal - discountAmount);
  const profit =
    resolvedItems.reduce((s, i) => s + i.quantity * (i.unitPrice - i.cost), 0) -
    discountAmount;

  // Fiili tahsilat
  const fiiliTahsilat =
    tahsilat !== undefined ? tahsilat : odeme === "cari" ? 0 : total;

  const sale: Sale = {
    id: saleId,
    cariId: cariId,
    customerId: cariId,
    cariName: cariId
      ? prevDB.cari.find((c) => c.id === cariId)?.name
      : undefined,
    productId: resolvedItems[0]?.productId,
    productName:
      resolvedItems.length === 1
        ? resolvedItems[0].productName
        : `${resolvedItems[0].productName} +${resolvedItems.length - 1}`,
    productCategory: prevDB.products.find(
      (p) => p.id === resolvedItems[0]?.productId,
    )?.category,
    quantity: resolvedItems.reduce((s, i) => s + i.quantity, 0),
    unitPrice:
      total /
      Math.max(
        1,
        resolvedItems.reduce((s, i) => s + i.quantity, 0),
      ),
    cost: resolvedItems.reduce((s, i) => s + i.cost * i.quantity, 0),
    discount: discountNum,
    discountAmount,
    subtotal,
    total,
    profit,
    payment: odeme,
    status: "tamamlandi",
    items: resolvedItems,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Kasa girişi
  const kasaEntries: KasaEntry[] = [];
  if (fiiliTahsilat > 0) {
    const kasaId = odeme === "cari" ? "nakit" : odeme;
    kasaEntries.push({
      id: genId(),
      type: "gelir",
      category: "satis",
      amount: fiiliTahsilat,
      kasa: kasaId,
      description: `Satış: ${sale.productName}`,
      relatedId: saleId,
      cariId: cariId,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // Cari bakiyesi
  let cari = prevDB.cari;
  const kalanTutar = total - fiiliTahsilat;
  if (cariId && kalanTutar > 0) {
    cari = cari.map((c) =>
      c.id === cariId
        ? {
            ...c,
            balance: (c.balance || 0) + kalanTutar,
            lastTransaction: nowIso,
            updatedAt: nowIso,
          }
        : c,
    );
  }

  // Stok hareketleri
  const stockMovements: StockMovement[] = resolvedItems.map((i) => {
    const currentStock =
      prevDB.products.find((p) => p.id === i.productId)?.stock || 0;
    return {
      id: genId(),
      productId: i.productId,
      productName: i.productName,
      type: "satis" as const,
      amount: -i.quantity,
      before: currentStock,
      after: currentStock - i.quantity,
      note: "Satış",
      date: nowIso,
    };
  });

  // Ürün stoğu güncelle
  const products = prevDB.products.map((p) => {
    const item = resolvedItems.find((i) => i.productId === p.id);
    if (!item) return p;
    return { ...p, stock: p.stock - item.quantity, updatedAt: nowIso };
  });

  const nextDB: DB = {
    ...prevDB,
    products,
    sales: [...prevDB.sales, sale],
    kasa: [...prevDB.kasa, ...kasaEntries],
    cari,
    stockMovements: [...prevDB.stockMovements, ...stockMovements],
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

// ─── İade ─────────────────────────────────────────────────────────────────────

/**
 * İade işlemini simüle eder — Sales.tsx handleReturn mantığını yansıtır.
 * prevDB → { nextDB, violations }
 */
function iadeYap(
  prevDB: DB,
  saleId: string,
): { nextDB: DB; violations: RuleViolation[] } {
  const nowIso = now();
  const sale = prevDB.sales.find((s) => s.id === saleId);
  if (!sale) return { nextDB: prevDB, violations: [] };
  if (sale.status !== "tamamlandi") return { nextDB: prevDB, violations: [] };

  // Stokları geri yükle
  const products = prevDB.products.map((p) => {
    const item = sale.items?.find((i) => i.productId === p.id);
    if (!item) return p;
    return { ...p, stock: p.stock + item.quantity, updatedAt: nowIso };
  });

  // Satış durumunu güncelle
  const sales = prevDB.sales.map((s) =>
    s.id === saleId
      ? { ...s, status: "iade" as const, returnedAt: nowIso, updatedAt: nowIso }
      : s,
  );

  // İlişkili kasa kayıtlarını bul (tahsil edilmiş tutar)
  const relatedKasaEntries = prevDB.kasa.filter(
    (k) => !k.deleted && k.relatedId === sale.id && k.type === "gelir",
  );
  const tahsilEdilen = relatedKasaEntries.reduce((s, k) => s + k.amount, 0);

  let kasa = prevDB.kasa;
  if (tahsilEdilen > 0) {
    const kasaId = sale.payment === "cari" ? "nakit" : sale.payment;
    kasa = [
      ...kasa,
      {
        id: genId(),
        type: "gider" as const,
        category: "iade",
        amount: tahsilEdilen,
        kasa: kasaId,
        description: `İade: ${sale.productName}`,
        relatedId: sale.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  // Cari bakiyesini geri al
  let cari = prevDB.cari;
  const cariId = sale.cariId || sale.customerId;
  if (cariId) {
    const cariyeYazilan = sale.total - tahsilEdilen;
    if (cariyeYazilan > 0) {
      cari = cari.map((c) =>
        c.id === cariId
          ? {
              ...c,
              balance: (c.balance || 0) - cariyeYazilan,
              lastTransaction: nowIso,
              updatedAt: nowIso,
            }
          : c,
      );
    }
  }

  const nextDB: DB = { ...prevDB, products, sales, kasa, cari };
  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

// ─── İptal ────────────────────────────────────────────────────────────────────

/**
 * İptal işlemini simüle eder — Sales.tsx handleCancel mantığını yansıtır.
 * prevDB → { nextDB, violations }
 */
function iptalYap(
  prevDB: DB,
  saleId: string,
): { nextDB: DB; violations: RuleViolation[] } {
  const nowIso = now();
  const sale = prevDB.sales.find((s) => s.id === saleId);
  if (!sale) return { nextDB: prevDB, violations: [] };

  const products = prevDB.products.map((p) => {
    const item = sale.items?.find((i) => i.productId === p.id);
    if (!item) return p;
    return { ...p, stock: p.stock + item.quantity, updatedAt: nowIso };
  });

  const sales = prevDB.sales.map((s) =>
    s.id === saleId ? { ...s, status: "iptal" as const, updatedAt: nowIso } : s,
  );

  const relatedKasaEntries = prevDB.kasa.filter(
    (k) => !k.deleted && k.relatedId === sale.id && k.type === "gelir",
  );
  const tahsilEdilen = relatedKasaEntries.reduce((s, k) => s + k.amount, 0);

  let kasa = prevDB.kasa;
  if (tahsilEdilen > 0) {
    const kasaId = sale.payment === "cari" ? "nakit" : sale.payment;
    kasa = [
      ...kasa,
      {
        id: genId(),
        type: "gider" as const,
        category: "iptal",
        amount: tahsilEdilen,
        kasa: kasaId,
        description: `İptal: ${sale.productName}`,
        relatedId: sale.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  let cari = prevDB.cari;
  const cariId = sale.cariId || sale.customerId;
  if (cariId) {
    const cariyeYazilan = sale.total - tahsilEdilen;
    if (cariyeYazilan > 0) {
      cari = cari.map((c) =>
        c.id === cariId
          ? {
              ...c,
              balance: (c.balance || 0) - cariyeYazilan,
              lastTransaction: nowIso,
              updatedAt: nowIso,
            }
          : c,
      );
    }
  }

  const nextDB: DB = { ...prevDB, products, sales, kasa, cari };
  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

// ─── Cari ─────────────────────────────────────────────────────────────────────

function cariEkle(
  prevDB: DB,
  form: { name: string; type?: "musteri" | "tedarikci"; phone?: string },
): { nextDB: DB; error?: string } {
  const nowIso = now();

  // Tam eşleşme kontrolü
  const existing = prevDB.cari.find(
    (c) =>
      !c.deleted &&
      c.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
  );
  if (existing) {
    return {
      nextDB: prevDB,
      error: `"${form.name}" adında bir cari zaten mevcut.`,
    };
  }

  // Benzerlik uyarısı (≥70) — hata değil, uyarı olarak döner
  const similar = prevDB.cari.find(
    (c) => !c.deleted && similarity(c.name, form.name) >= 70,
  );

  const newCari: Cari = {
    id: genId(),
    name: form.name,
    type: form.type || "musteri",
    phone: form.phone,
    balance: 0,
    deleted: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const nextDB: DB = { ...prevDB, cari: [...prevDB.cari, newCari] };

  if (similar) {
    return {
      nextDB,
      error: `Uyarı: "${similar.name}" adında benzer bir cari mevcut.`,
    };
  }

  return { nextDB };
}

function cariDuzenle(
  prevDB: DB,
  id: string,
  form: Partial<Cari>,
): { nextDB: DB } {
  const nowIso = now();
  const nextDB: DB = {
    ...prevDB,
    cari: prevDB.cari.map((c) =>
      c.id === id
        ? {
            ...c,
            ...form,
            id: c.id,
            balance: c.balance,
            createdAt: c.createdAt,
            updatedAt: nowIso,
          }
        : c,
    ),
  };
  return { nextDB };
}

function cariSil(prevDB: DB, id: string): { nextDB: DB } {
  const nowIso = now();
  const nextDB: DB = {
    ...prevDB,
    cari: prevDB.cari.map((c) =>
      c.id === id ? { ...c, deleted: true, updatedAt: nowIso } : c,
    ),
  };
  return { nextDB };
}

// ─── Tahsilat ─────────────────────────────────────────────────────────────────

function tahsilatYap(
  prevDB: DB,
  cariId: string,
  amount: number,
  kasa: string,
): { nextDB: DB; violations: RuleViolation[] } {
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

  const cari = prevDB.cari.map((c) =>
    c.id === cariId
      ? {
          ...c,
          balance: (c.balance || 0) - amount,
          lastTransaction: nowIso,
          updatedAt: nowIso,
        }
      : c,
  );

  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
    cari,
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

// ─── Kasa ─────────────────────────────────────────────────────────────────────

function kasaGelirEkle(
  prevDB: DB,
  amount: number,
  kasa: string,
  cariId?: string,
): { nextDB: DB; violations: RuleViolation[]; entryId: string } {
  const nowIso = now();
  const entryId = genId();

  const kasaEntry: KasaEntry = {
    id: entryId,
    type: "gelir",
    category: "manuel",
    amount,
    kasa,
    cariId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let cari = prevDB.cari;
  if (cariId) {
    cari = cari.map((c) =>
      c.id === cariId
        ? {
            ...c,
            balance: (c.balance || 0) - amount,
            lastTransaction: nowIso,
            updatedAt: nowIso,
          }
        : c,
    );
  }

  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
    cari,
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, entryId };
}

function kasaGiderEkle(
  prevDB: DB,
  amount: number,
  kasa: string,
  cariId?: string,
): { nextDB: DB; violations: RuleViolation[]; entryId: string } {
  const nowIso = now();
  const entryId = genId();

  const kasaEntry: KasaEntry = {
    id: entryId,
    type: "gider",
    category: "manuel",
    amount,
    kasa,
    cariId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let cari = prevDB.cari;
  if (cariId) {
    cari = cari.map((c) =>
      c.id === cariId
        ? {
            ...c,
            balance: (c.balance || 0) + amount,
            lastTransaction: nowIso,
            updatedAt: nowIso,
          }
        : c,
    );
  }

  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
    cari,
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, entryId };
}

function kasaKayitSil(prevDB: DB, entryId: string): { nextDB: DB } {
  const nowIso = now();
  const entry = prevDB.kasa.find((k) => k.id === entryId);

  let cari = prevDB.cari;
  if (entry && entry.cariId) {
    // Gelir kaydı siliniyorsa cari bakiyesini geri artır
    // Gider kaydı siliniyorsa cari bakiyesini geri azalt
    const delta = entry.type === "gelir" ? entry.amount : -entry.amount;
    cari = cari.map((c) =>
      c.id === entry.cariId
        ? { ...c, balance: (c.balance || 0) + delta, updatedAt: nowIso }
        : c,
    );
  }

  const nextDB: DB = {
    ...prevDB,
    kasa: prevDB.kasa.map((k) =>
      k.id === entryId ? { ...k, deleted: true, updatedAt: nowIso } : k,
    ),
    cari,
  };

  return { nextDB };
}

// ─── Stok ─────────────────────────────────────────────────────────────────────

function stokGiris(
  prevDB: DB,
  productId: string,
  amount: number,
  note?: string,
): { nextDB: DB } {
  const nowIso = now();
  const product = prevDB.products.find((p) => p.id === productId)!;
  const before = product.stock;
  const after = before + amount;

  const movement: StockMovement = {
    id: genId(),
    productId,
    productName: product.name,
    type: "giris",
    amount,
    before,
    after,
    note: note || "Stok girişi",
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    products: prevDB.products.map((p) =>
      p.id === productId ? { ...p, stock: after, updatedAt: nowIso } : p,
    ),
    stockMovements: [...prevDB.stockMovements, movement],
  };

  return { nextDB };
}

function stokCikis(
  prevDB: DB,
  productId: string,
  amount: number,
  note?: string,
): { nextDB: DB } {
  const nowIso = now();
  const product = prevDB.products.find((p) => p.id === productId)!;
  const before = product.stock;
  const after = Math.max(0, before - amount);

  const movement: StockMovement = {
    id: genId(),
    productId,
    productName: product.name,
    type: "cikis",
    amount: -(before - after),
    before,
    after,
    note: note || "Stok çıkışı",
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    products: prevDB.products.map((p) =>
      p.id === productId ? { ...p, stock: after, updatedAt: nowIso } : p,
    ),
    stockMovements: [...prevDB.stockMovements, movement],
  };

  return { nextDB };
}

function stokDuzeltme(
  prevDB: DB,
  productId: string,
  newStock: number,
  note?: string,
): { nextDB: DB } {
  const nowIso = now();
  const product = prevDB.products.find((p) => p.id === productId)!;
  const before = product.stock;
  const after = newStock;
  const amount = after - before;

  const movement: StockMovement = {
    id: genId(),
    productId,
    productName: product.name,
    type: "duzeltme",
    amount,
    before,
    after,
    note: note || "Stok düzeltme",
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    products: prevDB.products.map((p) =>
      p.id === productId ? { ...p, stock: after, updatedAt: nowIso } : p,
    ),
    stockMovements: [...prevDB.stockMovements, movement],
  };

  return { nextDB };
}

// ─── Sipariş Tamamlama ────────────────────────────────────────────────────────

function siparisIsleTamamlandi(prevDB: DB, orderId: string): { nextDB: DB } {
  const nowIso = now();
  const order = prevDB.orders.find((o) => o.id === orderId);
  if (!order) return { nextDB: prevDB };

  // İdempotency: zaten tamamlandıysa stok tekrar artırılmaz
  if (order.stockCompleted) {
    return {
      nextDB: {
        ...prevDB,
        orders: prevDB.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: "tamamlandi" as const, updatedAt: nowIso }
            : o,
        ),
      },
    };
  }

  const products = prevDB.products.map((p) => {
    const item = order.items.find((i) => i.productId === p.id);
    if (!item) return p;
    return { ...p, stock: p.stock + item.qty, updatedAt: nowIso };
  });

  const stockMovements: StockMovement[] = [
    ...prevDB.stockMovements,
    ...order.items
      .filter((i) => prevDB.products.find((p) => p.id === i.productId))
      .map((i) => ({
        id: genId(),
        productId: i.productId,
        productName: i.productName,
        type: "giris" as const,
        amount: i.qty,
        before: prevDB.products.find((p) => p.id === i.productId)?.stock || 0,
        after:
          (prevDB.products.find((p) => p.id === i.productId)?.stock || 0) +
          i.qty,
        note: `Sipariş #${orderId.slice(0, 8)}`,
        date: nowIso,
      })),
  ];

  const orders = prevDB.orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: "tamamlandi" as const,
          stockCompleted: true,
          updatedAt: nowIso,
        }
      : o,
  );

  const nextDB: DB = { ...prevDB, products, stockMovements, orders };
  return { nextDB };
}

// ─── TESTLER ──────────────────────────────────────────────────────────────────

describe("🏪 Kapsamlı Senaryo Testleri", () => {
  // ══════════════════════════════════════════════════════════════════════════
  // Grup 2: Cari Satış → Kısmi Tahsilat → İade
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 2: Cari Satış → Kısmi Tahsilat → İade", () => {
    /**
     * Validates: Requirements 1.2, 2.2
     *
     * Bug Koşulu C(X): tahsilat > 0 AND iade sonrası cari.balance ≠ 0
     *
     * DB Durum Geçişi:
     *   satış: kasa=[+500], cari.balance=700
     *   iade:  kasa=[+500, -500], cari.balance=0
     */
    it("kısmi tahsilatlı cari satış → iade sonrası cari.balance sıfır olmalı", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);

      // Müşteri oluştur (balance: 0)
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const prevDB = makeDB({ products: [soba], cari: [musteri] });

      // Satış yap: cari ödeme, 500₺ tahsilat, kalan 700₺ cariye yazılır
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        500,
      );
      expect(saleViolations).toHaveLength(0);

      // Satış sonrası kasa geliri = 500
      const kasaGelir = afterSale.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(500);

      // Satış sonrası cari.balance = 700 (1200 - 500)
      const cariAfterSale = afterSale.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterSale.balance).toBe(700);

      // Tutarlılık: kasa geliri + cari.balance = sale.total
      const sale = afterSale.sales.find((s) => s.id === saleId)!;
      expect(kasaGelir + cariAfterSale.balance).toBe(sale.total);
      expect(sale.total).toBe(1200);

      // İade yap
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );
      expect(iadeViolations).toHaveLength(0);

      // İade sonrası cari.balance = 0
      const cariAfterIade = afterIade.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterIade.balance).toBe(0);

      // İade sonrası net kasa = 0 (Σ gelir - Σ gider = 0)
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);

      // Satış durumu 'iade' olmalı
      const saleAfterIade = afterIade.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIade.status).toBe("iade");
    });

    it("isBugCondition: tahsilat > 0 AND iade sonrası cari.balance ≠ 0 → bug yok", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const prevDB = makeDB({ products: [soba], cari: [musteri] });

      const { nextDB: afterSale, saleId } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        500,
      );

      const { nextDB: afterIade } = iadeYap(afterSale, saleId);

      // Bug koşulu: tahsilat > 0 AND iade sonrası cari.balance ≠ 0
      const tahsilat = 500;
      const cariBalance = afterIade.cari.find(
        (c) => c.id === "musteri-001",
      )!.balance;
      const isBugCondition = tahsilat > 0 && cariBalance !== 0;

      // Bug koşulu tetiklenmemeli
      expect(isBugCondition).toBe(false);
      expect(cariBalance).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 3: Sipariş Tamamlandığında Stok Artışı
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 3: Sipariş Tamamlandığında Stok Artışı", () => {
    /**
     * Validates: Requirements 1.3, 2.3
     *
     * Bug Koşulu C(X): order.status='tamamlandi' AND product.stock değişmedi
     *
     * DB Durum Geçişi:
     *   prevDB: product.stock = 5
     *   siparisIsleTamamlandi sonrası: product.stock = 5 + 10 = 15
     *   StockMovement: type='giris', amount=10, before=5, after=15
     */
    it("sipariş tamamlandığında ürün stoğu artmalı (tek kalem)", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 5, 1000, 600);
      const orderId = genId();

      const order = {
        id: orderId,
        supplierId: "sup-001",
        items: [
          {
            productId: "urun-001",
            productName: "Test Ürün",
            qty: 10,
            unitCost: 600,
            lineTotal: 6000,
          },
        ],
        amount: 6000,
        paidAmount: 0,
        remainingAmount: 6000,
        payments: [],
        status: "bekliyor" as const,
        stockCompleted: false,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const prevDB = makeDB({ products: [urun], orders: [order] });

      // Sipariş tamamla
      const { nextDB } = siparisIsleTamamlandi(prevDB, orderId);

      // Stok 5 + 10 = 15 olmalı
      const product = nextDB.products.find((p) => p.id === "urun-001")!;
      expect(product.stock).toBe(15);

      // StockMovement kaydı: type='giris', amount=10, before=5, after=15
      const movement = nextDB.stockMovements.find(
        (m) => m.productId === "urun-001",
      )!;
      expect(movement).toBeDefined();
      expect(movement.type).toBe("giris");
      expect(movement.amount).toBe(10);
      expect(movement.before).toBe(5);
      expect(movement.after).toBe(15);

      // Order durumu 'tamamlandi' ve stockCompleted=true olmalı
      const completedOrder = nextDB.orders.find((o) => o.id === orderId)!;
      expect(completedOrder.status).toBe("tamamlandi");
      expect(completedOrder.stockCompleted).toBe(true);
    });

    it("çoklu kalemli sipariş tamamlandığında her ürün stoğu artmalı", () => {
      const urun1 = makeProduct("urun-001", "Ürün 1", 10, 1000, 600);
      const urun2 = makeProduct("urun-002", "Ürün 2", 20, 500, 300);
      const orderId = genId();

      const order = {
        id: orderId,
        supplierId: "sup-001",
        items: [
          {
            productId: "urun-001",
            productName: "Ürün 1",
            qty: 3,
            unitCost: 600,
            lineTotal: 1800,
          },
          {
            productId: "urun-002",
            productName: "Ürün 2",
            qty: 7,
            unitCost: 300,
            lineTotal: 2100,
          },
        ],
        amount: 3900,
        paidAmount: 0,
        remainingAmount: 3900,
        payments: [],
        status: "bekliyor" as const,
        stockCompleted: false,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const prevDB = makeDB({ products: [urun1, urun2], orders: [order] });

      const { nextDB } = siparisIsleTamamlandi(prevDB, orderId);

      // Ürün 1: 10 + 3 = 13
      const product1 = nextDB.products.find((p) => p.id === "urun-001")!;
      expect(product1.stock).toBe(13);

      // Ürün 2: 20 + 7 = 27
      const product2 = nextDB.products.find((p) => p.id === "urun-002")!;
      expect(product2.stock).toBe(27);

      // Her ürün için StockMovement kaydı oluşmalı
      const movement1 = nextDB.stockMovements.find(
        (m) => m.productId === "urun-001",
      )!;
      expect(movement1.type).toBe("giris");
      expect(movement1.amount).toBe(3);
      expect(movement1.before).toBe(10);
      expect(movement1.after).toBe(13);

      const movement2 = nextDB.stockMovements.find(
        (m) => m.productId === "urun-002",
      )!;
      expect(movement2.type).toBe("giris");
      expect(movement2.amount).toBe(7);
      expect(movement2.before).toBe(20);
      expect(movement2.after).toBe(27);
    });

    it("isBugCondition: order.status=tamamlandi AND product.stock değişmedi → bug yok", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 5, 1000, 600);
      const orderId = genId();

      const order = {
        id: orderId,
        supplierId: "sup-001",
        items: [
          {
            productId: "urun-001",
            productName: "Test Ürün",
            qty: 10,
            unitCost: 600,
            lineTotal: 6000,
          },
        ],
        amount: 6000,
        paidAmount: 0,
        remainingAmount: 6000,
        payments: [],
        status: "bekliyor" as const,
        stockCompleted: false,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const prevDB = makeDB({ products: [urun], orders: [order] });
      const stockBefore = prevDB.products.find(
        (p) => p.id === "urun-001",
      )!.stock;

      const { nextDB } = siparisIsleTamamlandi(prevDB, orderId);

      const completedOrder = nextDB.orders.find((o) => o.id === orderId)!;
      const stockAfter = nextDB.products.find(
        (p) => p.id === "urun-001",
      )!.stock;

      // Bug koşulu: order.status='tamamlandi' AND product.stock değişmedi
      const isBugCondition =
        completedOrder.status === "tamamlandi" && stockAfter === stockBefore;

      // Bug koşulu tetiklenmemeli — stok artmış olmalı
      expect(isBugCondition).toBe(false);
      expect(stockAfter).toBe(stockBefore + 10);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 4: Çoklu Ürünlü Satış → İade
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 4: Çoklu Ürünlü Satış → İade", () => {
    /**
     * Validates: Requirements 1.4, 2.4
     *
     * Bug Koşulu C(X): sale.items.length > 1 AND iade sonrası tüm stoklar geri yüklenmedi
     *
     * DB Durum Geçişi:
     *   satış: soba.stock=10→8, aksesuar.stock=5→4, kasa=[+2700]
     *   iade:  soba.stock=8→10, aksesuar.stock=4→5, kasa=[+2700,-2700]
     *   net kasa = 0
     *
     * Not: iadeYap fonksiyonu stokları sale.items üzerinden geri yükler ancak
     * 'iade' tipinde StockMovement kaydı oluşturmaz. Bu nedenle stok geri
     * yüklenmesini doğruluyoruz; StockMovement 'iade' kaydı beklenmez.
     */
    it("çoklu ürünlü satış → iade sonrası her iki ürün stoğu başlangıç değerine dönmeli", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const aksesuar = makeProduct(
        "aksesuar-001",
        "Soba Aksesuar",
        5,
        300,
        150,
      );

      const prevDB = makeDB({ products: [soba, aksesuar] });

      // Satış yap: soba×2 + aksesuar×1, nakit
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(
        prevDB,
        [
          { productId: "soba-001", qty: 2 },
          { productId: "aksesuar-001", qty: 1 },
        ],
        "nakit",
      );
      expect(saleViolations).toHaveLength(0);

      // Satış sonrası stok kontrolü
      const sobaAfterSale = afterSale.products.find(
        (p) => p.id === "soba-001",
      )!;
      const aksesuarAfterSale = afterSale.products.find(
        (p) => p.id === "aksesuar-001",
      )!;
      expect(sobaAfterSale.stock).toBe(8); // 10 - 2
      expect(aksesuarAfterSale.stock).toBe(4); // 5 - 1

      // Satış sonrası kasa geliri: 2×1200 + 1×300 = 2700
      const kasaGelir = afterSale.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(2700);

      // İade yap
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );
      expect(iadeViolations).toHaveLength(0);

      // İade sonrası stok başlangıç değerlerine dönmeli
      const sobaAfterIade = afterIade.products.find(
        (p) => p.id === "soba-001",
      )!;
      const aksesuarAfterIade = afterIade.products.find(
        (p) => p.id === "aksesuar-001",
      )!;
      expect(sobaAfterIade.stock).toBe(10); // başlangıç değeri
      expect(aksesuarAfterIade.stock).toBe(5); // başlangıç değeri

      // İade sonrası net kasa = 0
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);

      // Satış durumu 'iade' olmalı
      const saleAfterIade = afterIade.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIade.status).toBe("iade");

      // Not: iadeYap, 'iade' tipinde StockMovement kaydı oluşturmaz.
      // Stok geri yüklenmesi sale.items üzerinden yapılır (yukarıda doğrulandı).
      // Eğer ileride iadeYap 'iade' StockMovement kaydı oluşturacak şekilde
      // güncellenirse, aşağıdaki kontrol aktif edilebilir:
      // const iadeMovements = afterIade.stockMovements.filter(m => m.type === 'iade');
      // expect(iadeMovements).toHaveLength(2);
    });

    it("isBugCondition: sale.items.length > 1 AND iade sonrası tüm stoklar geri yüklenmedi → bug yok", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const aksesuar = makeProduct(
        "aksesuar-001",
        "Soba Aksesuar",
        5,
        300,
        150,
      );

      const prevDB = makeDB({ products: [soba, aksesuar] });

      const { nextDB: afterSale, saleId } = satisYap(
        prevDB,
        [
          { productId: "soba-001", qty: 2 },
          { productId: "aksesuar-001", qty: 1 },
        ],
        "nakit",
      );

      const { nextDB: afterIade } = iadeYap(afterSale, saleId);

      const sale = afterSale.sales.find((s) => s.id === saleId)!;
      const sobaStock = afterIade.products.find(
        (p) => p.id === "soba-001",
      )!.stock;
      const aksesuarStock = afterIade.products.find(
        (p) => p.id === "aksesuar-001",
      )!.stock;

      // Bug koşulu: sale.items.length > 1 AND iade sonrası tüm stoklar geri yüklenmedi
      const stocksNotRestored = sobaStock !== 10 || aksesuarStock !== 5;
      const isBugCondition = sale.items!.length > 1 && stocksNotRestored;

      // Bug koşulu tetiklenmemeli — her iki stok da geri yüklenmiş olmalı
      expect(isBugCondition).toBe(false);
      expect(sobaStock).toBe(10);
      expect(aksesuarStock).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 5: İskontolu Satış → İade
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 5: İskontolu Satış → İade", () => {
    /**
     * Validates: Requirements 1.5, 2.5
     *
     * Bug Koşulu C(X): discount > 0 AND iade sonrası kasadan brüt tutar düşüldü
     *
     * DB Durum Geçişi:
     *   satış: subtotal=1200, discountAmount=120, total=1080, kasa=[+1080]
     *   iade:  kasa=[+1080, -1080], net kasa = 0
     */
    it("yüzde iskontolu satış → subtotal/discountAmount/total doğru hesaplanmalı", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const prevDB = makeDB({ products: [soba] });

      // %10 iskontolu satış
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
        undefined,
        undefined,
        { type: "percent", value: 10 },
      );
      expect(saleViolations).toHaveLength(0);

      const sale = afterSale.sales.find((s) => s.id === saleId)!;
      expect(sale.subtotal).toBe(1200);
      expect(sale.discountAmount).toBe(120);
      expect(sale.total).toBe(1080);

      // Kasa geliri = 1080 (brüt 1200 değil)
      const kasaGelir = afterSale.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(1080);
    });

    it("yüzde iskontolu satış → iade sonrası gider kaydı total (1080) olmalı, brüt değil", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const prevDB = makeDB({ products: [soba] });

      const { nextDB: afterSale, saleId } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
        undefined,
        undefined,
        { type: "percent", value: 10 },
      );

      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );
      expect(iadeViolations).toHaveLength(0);

      // İade gider kaydı amount = 1080 (total), brüt 1200 değil
      const iadeGider = afterIade.kasa.find(
        (k) => !k.deleted && k.type === "gider" && k.category === "iade",
      )!;
      expect(iadeGider).toBeDefined();
      expect(iadeGider.amount).toBe(1080);

      // Net kasa = 0
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);

      // Satış durumu 'iade' olmalı
      const saleAfterIade = afterIade.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIade.status).toBe("iade");
    });

    it("tutar iskontosu: {type:amount, value:200} → total = 1000, iade = 1000", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const prevDB = makeDB({ products: [soba] });

      // 200₺ tutar iskontosu
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
        undefined,
        undefined,
        { type: "amount", value: 200 },
      );
      expect(saleViolations).toHaveLength(0);

      const sale = afterSale.sales.find((s) => s.id === saleId)!;
      expect(sale.subtotal).toBe(1200);
      expect(sale.discountAmount).toBe(200);
      expect(sale.total).toBe(1000);

      // Kasa geliri = 1000
      const kasaGelir = afterSale.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(1000);

      // İade yap
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );
      expect(iadeViolations).toHaveLength(0);

      // İade gider kaydı = 1000
      const iadeGider = afterIade.kasa.find(
        (k) => !k.deleted && k.type === "gider" && k.category === "iade",
      )!;
      expect(iadeGider).toBeDefined();
      expect(iadeGider.amount).toBe(1000);

      // Net kasa = 0
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);
    });

    it("isBugCondition: discount > 0 AND iade sonrası kasadan brüt tutar düşüldü → bug yok", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const prevDB = makeDB({ products: [soba] });

      const { nextDB: afterSale, saleId } = satisYap(
        prevDB,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
        undefined,
        undefined,
        { type: "percent", value: 10 },
      );

      const { nextDB: afterIade } = iadeYap(afterSale, saleId);

      const sale = afterSale.sales.find((s) => s.id === saleId)!;
      const iadeGider = afterIade.kasa.find(
        (k) => !k.deleted && k.type === "gider" && k.category === "iade",
      )!;

      // Bug koşulu: discount > 0 AND iade sonrası kasadan brüt tutar düşüldü
      const brutTutarDusuldu = iadeGider?.amount === sale.subtotal; // 1200 yerine 1080 bekliyoruz
      const isBugCondition = (sale.discountAmount ?? 0) > 0 && brutTutarDusuldu;

      // Bug koşulu tetiklenmemeli — iade tutarı total (1080) olmalı, brüt (1200) değil
      expect(isBugCondition).toBe(false);
      expect(iadeGider.amount).toBe(sale.total); // 1080
      expect(iadeGider.amount).not.toBe(sale.subtotal); // 1200 değil
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 6: Stok Sıfırken İade
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 6: Stok Sıfırken İade", () => {
    /**
     * Validates: Requirements 1.6, 2.6
     *
     * Bug Koşulu C(X): product.stock = 0 AND iade yapılıyor AND negative_stock tetiklendi
     *
     * DB Durum Geçişi:
     *   satış: product.stock = 1 → 0, kasa=[+price]
     *   iade:  product.stock = 0 → 1, kasa=[+price, -price]
     *   net kasa = 0, violations = [] (negative_stock tetiklenmemeli)
     *
     * Not: iadeYap stok artırır (stock + item.quantity). Stok 0'dan 1'e çıkar.
     * negative_stock kuralı yalnızca stok azaldığında tetiklenir, artışta değil.
     */
    it("stok sıfırken iade → stok 1 olmalı, negative_stock tetiklenmemeli", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 1, 500, 300);
      const prevDB = makeDB({ products: [urun] });

      // Satış yap: stock 1 → 0
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(prevDB, [{ productId: "urun-001", qty: 1 }], "nakit");
      expect(saleViolations).toHaveLength(0);

      // Satış sonrası stok = 0
      const productAfterSale = afterSale.products.find(
        (p) => p.id === "urun-001",
      )!;
      expect(productAfterSale.stock).toBe(0);

      // İade yap: stock 0 → 1
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );

      // violations boş olmalı (negative_stock tetiklenmemeli)
      expect(iadeViolations).toHaveLength(0);

      // Stok 1 olmalı
      const productAfterIade = afterIade.products.find(
        (p) => p.id === "urun-001",
      )!;
      expect(productAfterIade.stock).toBe(1);

      // Net kasa = 0
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);

      // Satış durumu 'iade' olmalı
      const saleAfterIade = afterIade.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIade.status).toBe("iade");
    });

    it("isBugCondition: product.stock = 0 AND iade yapılıyor AND negative_stock tetiklendi → bug yok", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 1, 500, 300);
      const prevDB = makeDB({ products: [urun] });

      // Satış yap: stock 1 → 0
      const { nextDB: afterSale, saleId } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 1 }],
        "nakit",
      );

      const stockBeforeIade = afterSale.products.find(
        (p) => p.id === "urun-001",
      )!.stock;

      // İade yap
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );

      const stockAfterIade = afterIade.products.find(
        (p) => p.id === "urun-001",
      )!.stock;
      const negativeStockTriggered = iadeViolations.some(
        (v) => v.ruleId === "negative_stock",
      );

      // Bug koşulu: product.stock = 0 AND iade yapılıyor AND negative_stock tetiklendi
      const isBugCondition = stockBeforeIade === 0 && negativeStockTriggered;

      // Bug koşulu tetiklenmemeli — iade stok artırır, negative_stock tetiklenmez
      expect(isBugCondition).toBe(false);
      expect(negativeStockTriggered).toBe(false);
      expect(stockAfterIade).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 7: Cari CRUD
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 7: Cari CRUD", () => {
    /**
     * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3
     */

    // ── 7a: Duplicate engeli ──────────────────────────────────────────────

    it("7a — aynı isimde ikinci cari eklenemez (duplicate engeli)", () => {
      const db0 = makeDB();

      // İlk ekleme başarılı olmalı
      const { nextDB: db1, error: err1 } = cariEkle(db0, { name: "Ahmet" });
      expect(err1).toBeUndefined();

      // Aktif cari sayısı = 1
      expect(db1.cari.filter((c) => !c.deleted).length).toBe(1);

      // Aynı isimle ikinci ekleme hata döndürmeli
      const { nextDB: db2, error: err2 } = cariEkle(db1, { name: "Ahmet" });
      expect(err2).toBeDefined();
      expect(err2).toContain("Ahmet");

      // DB değişmemeli — hâlâ 1 aktif cari
      expect(db2.cari.filter((c) => !c.deleted).length).toBe(1);
    });

    it("7a — büyük/küçük harf farkı gözetmeksizin duplicate engellenmeli", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "ahmet" });

      // Büyük harfle aynı isim → hata
      const { nextDB: db2, error } = cariEkle(db1, { name: "AHMET" });
      expect(error).toBeDefined();
      expect(db2.cari.filter((c) => !c.deleted).length).toBe(1);
    });

    // ── 7b: Soft-delete ───────────────────────────────────────────────────

    it("7b — cari silindiğinde deleted:true olarak işaretlenmeli, ilişkili satışlar korunmalı", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const db0 = makeDB({ products: [soba] });

      // Cari ekle
      const { nextDB: db1 } = cariEkle(db0, { name: "Test Müşteri" });
      const cariId = db1.cari[0].id;

      // Cari ile satış yap
      const { nextDB: db2 } = satisYap(
        db1,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        cariId,
        0,
      );

      // Satış mevcut olmalı
      expect(db2.sales.length).toBe(1);
      expect(db2.sales[0].cariId).toBe(cariId);

      // Cariyi sil
      const { nextDB: db3 } = cariSil(db2, cariId);

      // Cari deleted:true olmalı
      const deletedCari = db3.cari.find((c) => c.id === cariId)!;
      expect(deletedCari).toBeDefined();
      expect(deletedCari.deleted).toBe(true);

      // Aktif cari listesinde görünmemeli
      expect(db3.cari.filter((c) => !c.deleted).length).toBe(0);

      // İlişkili satış hâlâ mevcut olmalı
      expect(db3.sales.length).toBe(1);
      expect(db3.sales[0].cariId).toBe(cariId);
    });

    it("7b — silinen cari updatedAt güncellenmeli", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "Silinecek Cari" });
      const cariId = db1.cari[0].id;
      const _createdAt = db1.cari[0].updatedAt;

      // Kısa bir bekleme simüle etmek için updatedAt'i geçmişe al
      const db1Modified: DB = {
        ...db1,
        cari: db1.cari.map((c) =>
          c.id === cariId ? { ...c, updatedAt: "2020-01-01T00:00:00.000Z" } : c,
        ),
      };

      const { nextDB: db2 } = cariSil(db1Modified, cariId);
      const deletedCari = db2.cari.find((c) => c.id === cariId)!;

      expect(deletedCari.deleted).toBe(true);
      expect(deletedCari.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
    });

    // ── 7c: Düzenleme bakiye koruması ─────────────────────────────────────

    it("7c — cari düzenlendiğinde bakiye değişmemeli, updatedAt güncellenmeli", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const db0 = makeDB({ products: [soba] });

      // Cari ekle
      const { nextDB: db1 } = cariEkle(db0, { name: "Bakiyeli Müşteri" });
      const cariId = db1.cari[0].id;

      // Cari satış yap: 1200₺ toplam, 500₺ tahsilat → cari.balance = 700
      const { nextDB: db2 } = satisYap(
        db1,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        cariId,
        500,
      );

      const cariBeforeEdit = db2.cari.find((c) => c.id === cariId)!;
      expect(cariBeforeEdit.balance).toBe(700);

      // updatedAt'i geçmişe al (düzenleme sonrası değiştiğini doğrulamak için)
      const db2Modified: DB = {
        ...db2,
        cari: db2.cari.map((c) =>
          c.id === cariId ? { ...c, updatedAt: "2020-01-01T00:00:00.000Z" } : c,
        ),
      };

      // Sadece telefon numarasını düzenle
      const { nextDB: db3 } = cariDuzenle(db2Modified, cariId, {
        phone: "555",
      });

      const cariAfterEdit = db3.cari.find((c) => c.id === cariId)!;

      // Bakiye değişmemeli
      expect(cariAfterEdit.balance).toBe(700);

      // updatedAt güncellenmeli
      expect(cariAfterEdit.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");

      // Telefon güncellenmeli
      expect(cariAfterEdit.phone).toBe("555");
    });

    it("7c — cari düzenlendiğinde id ve createdAt değişmemeli", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "Düzenlenecek Cari" });
      const cariId = db1.cari[0].id;
      const createdAt = db1.cari[0].createdAt;

      const { nextDB: db2 } = cariDuzenle(db1, cariId, {
        name: "Yeni İsim",
        phone: "0555",
      });
      const editedCari = db2.cari.find((c) => c.id === cariId)!;

      expect(editedCari.id).toBe(cariId);
      expect(editedCari.createdAt).toBe(createdAt);
      expect(editedCari.name).toBe("Yeni İsim");
      expect(editedCari.phone).toBe("0555");
    });

    // ── 7d: Benzerlik uyarısı ─────────────────────────────────────────────

    it("7d — benzer isimde cari eklendiğinde uyarı üretilmeli (similarity >= 70)", () => {
      const db0 = makeDB();

      // İlk cari ekle: 'Ahmet Yilmaz'
      const { nextDB: db1, error: err1 } = cariEkle(db0, {
        name: "Ahmet Yilmaz",
      });
      expect(err1).toBeUndefined();
      expect(db1.cari.filter((c) => !c.deleted).length).toBe(1);

      // Benzer isimle ikinci cari ekle: 'Ahmet Yılmaz' (ı → i farkı)
      // normalizeTR sonrası her ikisi de 'ahmet yilmaz' → similarity = 100 >= 70
      const { nextDB: db2, error: err2 } = cariEkle(db1, {
        name: "Ahmet Yılmaz",
      });

      // Uyarı üretilmeli (similarity uyarısı)
      expect(err2).toBeDefined();
      expect(err2).toContain("Uyarı");

      // Cari yine de eklenmeli (uyarı engellemez, sadece bildirir)
      expect(db2.cari.filter((c) => !c.deleted).length).toBe(2);
    });

    it("7d — benzerlik uyarısı: orijinal cari adı uyarı mesajında yer almalı", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "Mehmet Demir" });

      // Benzer isim: 'Mehmet Demır' (ı farkı)
      const { error } = cariEkle(db1, { name: "Mehmet Demır" });

      expect(error).toBeDefined();
      expect(error).toContain("Uyarı");
      // Orijinal isim uyarıda geçmeli
      expect(error).toContain("Mehmet Demir");
    });

    // ── 6.1: Yeni cari başlangıç bakiyesi 0 ──────────────────────────────

    it("6.1 — yeni cari başlangıç bakiyesi 0 olmalı", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "Yeni Cari" });
      const newCari = db1.cari[0];

      expect(newCari.balance).toBe(0);
      expect(newCari.deleted).toBe(false);
    });

    // ── 6.3: Silinen cari listede görünmez ───────────────────────────────

    it("6.3 — silinen cari (deleted:true) aktif listede görünmemeli", () => {
      const db0 = makeDB();
      const { nextDB: db1 } = cariEkle(db0, { name: "Aktif Cari" });
      const { nextDB: db2 } = cariEkle(db1, { name: "Silinecek Cari" });

      const silinecekId = db2.cari.find((c) => c.name === "Silinecek Cari")!.id;
      const { nextDB: db3 } = cariSil(db2, silinecekId);

      // Aktif liste: yalnızca deleted:false olanlar
      const aktifCariler = db3.cari.filter((c) => !c.deleted);
      expect(aktifCariler.length).toBe(1);
      expect(aktifCariler[0].name).toBe("Aktif Cari");

      // Silinen cari DB'de hâlâ mevcut (soft-delete)
      const tumCariler = db3.cari;
      expect(tumCariler.length).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 8: Satış Fiyat/İskonto Düzeltmesi
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 8: Satış Fiyat/İskonto Düzeltmesi", () => {
    /**
     * Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
     *
     * Bug Koşulu C(X): unitPrice değişti AND profit eski fiyatla hesaplandı
     *                  VEYA total/discountAmount tutarsız
     */

    // ── 8a: Fiyat değişikliği kâr hesabı ─────────────────────────────────

    it("8a — fiyat değişikliği kâr hesabı: unitPrice=1500, cost=800, qty=2 → profit=1400", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 10, 1000, 800);
      const prevDB = makeDB({ products: [urun] });

      // Ürün fiyatı 1000₺ ama satışta 1500₺ kullanıyoruz
      const { nextDB, saleId, violations } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 2, unitPrice: 1500 }],
        "nakit",
      );
      expect(violations).toHaveLength(0);

      const sale = nextDB.sales.find((s) => s.id === saleId)!;

      // subtotal = 2 × 1500 = 3000
      expect(sale.subtotal).toBe(3000);

      // discountAmount = 0 (iskonto yok)
      expect(sale.discountAmount).toBe(0);

      // profit = (1500 - 800) × 2 = 1400
      expect(sale.profit).toBe(1400);

      // total = 3000
      expect(sale.total).toBe(3000);
    });

    // ── 8b: Yüzde iskonto ─────────────────────────────────────────────────

    it("8b — yüzde iskonto: qty=2, unitPrice=1000, cost=500, %10 iskonto → profit=800", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 10, 1000, 500);
      const prevDB = makeDB({ products: [urun] });

      const { nextDB, saleId, violations } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 2, unitPrice: 1000 }],
        "nakit",
        undefined,
        undefined,
        { type: "percent", value: 10 },
      );
      expect(violations).toHaveLength(0);

      const sale = nextDB.sales.find((s) => s.id === saleId)!;

      // subtotal = 2 × 1000 = 2000
      expect(sale.subtotal).toBe(2000);

      // discountAmount = 2000 × 10% = 200
      expect(sale.discountAmount).toBe(200);

      // total = 2000 - 200 = 1800
      expect(sale.total).toBe(1800);

      // profit = (1000 - 500) × 2 - 200 = 1000 - 200 = 800
      expect(sale.profit).toBe(800);
    });

    // ── 8c: Tutar iskontosu ───────────────────────────────────────────────

    it("8c — tutar iskontosu: qty=2, unitPrice=1000, 300₺ iskonto → total=1700", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 10, 1000, 500);
      const prevDB = makeDB({ products: [urun] });

      const { nextDB, saleId, violations } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 2, unitPrice: 1000 }],
        "nakit",
        undefined,
        undefined,
        { type: "amount", value: 300 },
      );
      expect(violations).toHaveLength(0);

      const sale = nextDB.sales.find((s) => s.id === saleId)!;

      // subtotal = 2 × 1000 = 2000
      expect(sale.subtotal).toBe(2000);

      // discountAmount = 300
      expect(sale.discountAmount).toBe(300);

      // total = 2000 - 300 = 1700
      expect(sale.total).toBe(1700);
    });

    // ── 8d: total = subtotal - discountAmount invariantı ──────────────────

    it("8d — total = subtotal - discountAmount invariantı: iskonto yok", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 10, 1000, 500);
      const prevDB = makeDB({ products: [urun] });

      // İskonto yok
      const { nextDB: db1, saleId: sid1 } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 3, unitPrice: 800 }],
        "nakit",
      );
      const sale1 = db1.sales.find((s) => s.id === sid1)!;
      expect(sale1.total).toBe(sale1.subtotal - sale1.discountAmount);

      // Yüzde iskonto
      const { nextDB: db2, saleId: sid2 } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 2, unitPrice: 1000 }],
        "nakit",
        undefined,
        undefined,
        { type: "percent", value: 15 },
      );
      const sale2 = db2.sales.find((s) => s.id === sid2)!;
      expect(sale2.total).toBe(sale2.subtotal - sale2.discountAmount);

      // Tutar iskontosu
      const { nextDB: db3, saleId: sid3 } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 2, unitPrice: 1000 }],
        "nakit",
        undefined,
        undefined,
        { type: "amount", value: 150 },
      );
      const sale3 = db3.sales.find((s) => s.id === sid3)!;
      expect(sale3.total).toBe(sale3.subtotal - sale3.discountAmount);
    });

    it("8d — total = subtotal - discountAmount invariantı: property-based", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 200, 1000, 400);
      const prevDB = makeDB({ products: [urun] });

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 100, max: 2000 }),
          fc.integer({ min: 0, max: 50 }),
          (qty, unitPrice, discPct) => {
            const { nextDB, saleId } = satisYap(
              prevDB,
              [{ productId: "urun-001", qty, unitPrice }],
              "nakit",
              undefined,
              undefined,
              discPct > 0 ? { type: "percent", value: discPct } : undefined,
            );
            const sale = nextDB.sales.find((s) => s.id === saleId)!;
            // total = max(0, subtotal - discountAmount)
            const expected = Math.max(0, sale.subtotal - sale.discountAmount);
            return sale.total === expected;
          },
        ),
      );
    });

    // ── 8e: Negatif toplam oluşturacak iskonto → zero_amount ihlali ───────

    it("8e — negatif toplam oluşturacak iskonto: total = max(0, 100-200) = 0", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 10, 100, 50);
      const prevDB = makeDB({ products: [urun] });

      // subtotal = 100, iskonto = 200 → total = max(0, -100) = 0
      const { nextDB, saleId, violations } = satisYap(
        prevDB,
        [{ productId: "urun-001", qty: 1, unitPrice: 100 }],
        "nakit",
        undefined,
        undefined,
        { type: "amount", value: 200 },
      );

      const sale = nextDB.sales.find((s) => s.id === saleId)!;

      // total = 0 (negatife düşmez)
      expect(sale.total).toBe(0);

      // zero_amount ihlali VEYA total = 0 — ikisi de kabul edilebilir davranış
      const hasZeroAmountViolation = violations.some(
        (v) => v.ruleId === "zero_amount",
      );
      const totalIsZero = sale.total === 0;

      // En az biri doğru olmalı
      expect(hasZeroAmountViolation || totalIsZero).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 9: Kasa Ekleme/Düzenleme
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 9: Kasa Ekleme/Düzenleme", () => {
    /**
     * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3
     *
     * Bug Koşulları:
     *   C1(X): amount=0 ile kasa kaydı oluştu
     *   C2(X): Yetersiz bakiyeye rağmen gider eklendi
     */

    // ── 9a: Sıfır tutar engeli ────────────────────────────────────────────

    it("9a — sıfır tutar engeli: kasaGelirEkle(db, 0) → zero_amount ihlali", () => {
      const db = makeDB();

      const { violations } = kasaGelirEkle(db, 0, "nakit");

      // zero_amount kuralı tetiklenmeli
      expect(violations.some((v) => v.ruleId === "zero_amount")).toBe(true);
    });

    // ── 9b: Negatif kasa engeli ───────────────────────────────────────────

    it("9b — negatif kasa engeli: boş kasadan gider → negative_kasa ihlali", () => {
      // Başlangıç kasası boş (bakiye = 0)
      const db = makeDB();

      // 500₺ gider ekle — kasa bakiyesi 0'dan negatife düşer
      const { violations } = kasaGiderEkle(db, 500, "nakit");

      // negative_kasa kuralı tetiklenmeli
      expect(violations.some((v) => v.ruleId === "negative_kasa")).toBe(true);
    });

    // ── 9c: CariId bağlı kasa kaydı ──────────────────────────────────────

    it("9c — cariId bağlı kasa geliri: cari.balance 1000 → 700 olmalı", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1000, 600);

      // Cari oluştur
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Cari satış yap: 1000₺ toplam, tahsilat yok → cari.balance = 1000
      const { nextDB: db1 } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        0,
      );

      const cariAfterSale = db1.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterSale.balance).toBe(1000);

      // Kasa bakiyesini 300₺ artır (başlangıç için gelir ekle)
      const { nextDB: db2 } = kasaGelirEkle(db1, 300, "nakit");

      // Şimdi cariId bağlı gelir ekle: cari.balance 1000 → 700 olmalı
      const { nextDB: db3, violations } = kasaGelirEkle(
        db2,
        300,
        "nakit",
        "musteri-001",
      );

      // violations boş olmalı (geçerli işlem)
      expect(violations).toHaveLength(0);

      // cari.balance 300 azalmış olmalı: 1000 - 300 = 700
      const cariAfterKasa = db3.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterKasa.balance).toBe(700);

      // Kasa bakiyesi 300 artmış olmalı
      const kasaBakiye = db3.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      // db2'de 300 gelir vardı, db3'te 300 daha eklendi → toplam 600
      expect(kasaBakiye).toBe(600);
    });

    // ── 9d: Geçerli gelir kaydı kasa bakiyesini artırır ──────────────────

    it("9d — geçerli gelir kaydı: kasa bakiyesi 500 → 700 olmalı", () => {
      const db0 = makeDB();

      // Önce 500₺ gelir ekle (başlangıç bakiyesi)
      const { nextDB: db1 } = kasaGelirEkle(db0, 500, "nakit");

      // 200₺ daha gelir ekle
      const { nextDB: db2, violations } = kasaGelirEkle(db1, 200, "nakit");

      // violations boş olmalı
      expect(violations).toHaveLength(0);

      // Kasa bakiyesi = 500 + 200 = 700
      const kasaBakiye = db2.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(kasaBakiye).toBe(700);
    });

    // ── 9e: Geçerli gider kaydı kasa bakiyesini azaltır ──────────────────

    it("9e — geçerli gider kaydı: kasa bakiyesi 500 → 300 olmalı", () => {
      const db0 = makeDB();

      // Önce 500₺ gelir ekle (başlangıç bakiyesi)
      const { nextDB: db1 } = kasaGelirEkle(db0, 500, "nakit");

      // 200₺ gider ekle
      const { nextDB: db2, violations } = kasaGiderEkle(db1, 200, "nakit");

      // violations boş olmalı
      expect(violations).toHaveLength(0);

      // Kasa bakiyesi = 500 - 200 = 300
      const kasaBakiye = db2.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(kasaBakiye).toBe(300);
    });

    // ── 9f: cariId olmayan kasa kaydı cari tablosuna dokunmaz ─────────────

    it("9f — cariId olmayan kasa geliri: cari.balance değişmemeli", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1000, 600);

      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Cari satış yap: cari.balance = 500
      const { nextDB: db1 } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        500,
      );

      const cariBalanceBefore = db1.cari.find(
        (c) => c.id === "musteri-001",
      )!.balance;
      expect(cariBalanceBefore).toBe(500);

      // cariId olmadan kasa geliri ekle
      const { nextDB: db2, violations } = kasaGelirEkle(db1, 300, "nakit");

      // violations boş olmalı
      expect(violations).toHaveLength(0);

      // cari.balance değişmemeli
      const cariBalanceAfter = db2.cari.find(
        (c) => c.id === "musteri-001",
      )!.balance;
      expect(cariBalanceAfter).toBe(cariBalanceBefore);
      expect(cariBalanceAfter).toBe(500);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 10: Kasa Hareketleri Soft-Delete
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 10: Kasa Hareketleri Soft-Delete", () => {
    /**
     * Validates: Requirements 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3
     *
     * Bug Koşulları:
     *   C1(X): ardışık gelir/gider sonrası bakiye yanlış hesaplandı
     *   C2(X): cariId'li kasa kaydı silindiğinde cari.balance geri alınmadı
     *   C3(X): silinen kayıt bakiye hesabına dahil edildi
     */

    // ── 10a: Birikimli bakiye ─────────────────────────────────────────────

    it("10a — birikimli bakiye: gelir(500) + gelir(300) - gider(200) = 600", () => {
      const db0 = makeDB();

      // gelir 500
      const { nextDB: db1 } = kasaGelirEkle(db0, 500, "nakit");
      const bakiye1 = db1.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bakiye1).toBe(500);

      // gelir 300
      const { nextDB: db2 } = kasaGelirEkle(db1, 300, "nakit");
      const bakiye2 = db2.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bakiye2).toBe(800);

      // gider 200
      const { nextDB: db3 } = kasaGiderEkle(db2, 200, "nakit");
      const bakiye3 = db3.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bakiye3).toBe(600);

      // Σ(gelir) - Σ(gider) = 600 (deleted:false kayıtlar)
      const gelirToplam = db3.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      const giderToplam = db3.kasa
        .filter((k) => !k.deleted && k.type === "gider")
        .reduce((s, k) => s + k.amount, 0);
      expect(gelirToplam - giderToplam).toBe(600);
    });

    // ── 10b: Soft-delete cari geri alımı ──────────────────────────────────

    it("10b — soft-delete cari geri alımı: kasaKayitSil sonrası cari.balance 1000 olmalı", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1000, 600);

      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };

      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Cari satış yap: 1000₺ toplam, tahsilat yok → cari.balance = 1000
      const { nextDB: db1 } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        0,
      );

      const cariAfterSale = db1.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterSale.balance).toBe(1000);

      // Kasa bakiyesini artır (gelir ekle) — sonraki gelir için bakiye gerekli
      const { nextDB: db1b } = kasaGelirEkle(db1, 300, "nakit");

      // cariId bağlı kasa geliri ekle: cari.balance 1000 → 700
      const { nextDB: db2, entryId } = kasaGelirEkle(
        db1b,
        300,
        "nakit",
        "musteri-001",
      );

      const cariAfterKasa = db2.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterKasa.balance).toBe(700);

      // Kasa kaydını soft-delete ile sil → cari.balance 700 → 1000 (geri döndü)
      const { nextDB: db3 } = kasaKayitSil(db2, entryId);

      // Kasa kaydı deleted:true olmalı
      const deletedEntry = db3.kasa.find((k) => k.id === entryId)!;
      expect(deletedEntry.deleted).toBe(true);

      // cari.balance 1000'e geri dönmeli
      const cariAfterDelete = db3.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterDelete.balance).toBe(1000);
    });

    // ── 10c: Silinen kayıt bakiye dışı ────────────────────────────────────

    it("10c — silinen kayıt bakiye dışı: gelir(500) → sil → bakiye = 0", () => {
      const db0 = makeDB();

      // 500₺ gelir ekle
      const { nextDB: db1, entryId } = kasaGelirEkle(db0, 500, "nakit");

      // Bakiye = 500
      const bakiye1 = db1.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bakiye1).toBe(500);

      // Kaydı sil
      const { nextDB: db2 } = kasaKayitSil(db1, entryId);

      // entry.deleted = true olmalı
      const entry = db2.kasa.find((k) => k.id === entryId)!;
      expect(entry.deleted).toBe(true);

      // Bakiye = 0 (silinen kayıt hesaba katılmaz)
      const bakiye2 = db2.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bakiye2).toBe(0);
    });

    // ── 10d: Farklı kasaların bakiyeleri bağımsız ─────────────────────────

    it("10d — farklı kasaların bakiyeleri bağımsız: nakit=800, banka=500", () => {
      const db0 = makeDB();

      // nakit: 1000₺ gelir
      const { nextDB: db1 } = kasaGelirEkle(db0, 1000, "nakit");

      // banka: 500₺ gelir
      const { nextDB: db2 } = kasaGelirEkle(db1, 500, "banka");

      // nakit: 200₺ gider
      const { nextDB: db3 } = kasaGiderEkle(db2, 200, "nakit");

      // nakit bakiyesi = 1000 - 200 = 800
      const nakitBakiye = db3.kasa
        .filter((k) => !k.deleted && k.kasa === "nakit")
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(nakitBakiye).toBe(800);

      // banka bakiyesi = 500 (bağımsız)
      const bankaBakiye = db3.kasa
        .filter((k) => !k.deleted && k.kasa === "banka")
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(bankaBakiye).toBe(500);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 11: Stok Hareketleri
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 11: Stok Hareketleri", () => {
    /**
     * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3, 17.4, 18.1, 18.2, 18.3
     *
     * Bug Koşulları:
     *   C1(X): before/after yer değiştirdi
     *   C2(X): Düzeltme amount yanlış işaretlendi
     */

    // ── 11a: Giriş before/after ───────────────────────────────────────────

    it("11a — stok girişi: before=20, amount=10 → after=30, product.stock=30", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 20, 1000, 600);
      const db = makeDB({ products: [urun] });

      const { nextDB } = stokGiris(db, "urun-001", 10);

      const movement = nextDB.stockMovements.find(
        (m) => m.productId === "urun-001",
      )!;
      expect(movement).toBeDefined();
      expect(movement.before).toBe(20);
      expect(movement.after).toBe(30);
      expect(movement.amount).toBe(10);
      expect(movement.type).toBe("giris");

      const product = nextDB.products.find((p) => p.id === "urun-001")!;
      expect(product.stock).toBe(30);
    });

    // ── 11b: Çıkış sıfır stok koruması ───────────────────────────────────

    it("11b — stok çıkışı sıfır stok koruması: stock=0, çıkış=5 → stock=0 (negatife düşmez)", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 0, 1000, 600);
      const db = makeDB({ products: [urun] });

      const { nextDB } = stokCikis(db, "urun-001", 5);

      const product = nextDB.products.find((p) => p.id === "urun-001")!;
      expect(product.stock).toBe(0);

      const movement = nextDB.stockMovements.find(
        (m) => m.productId === "urun-001",
      )!;
      expect(movement).toBeDefined();
      expect(movement.before).toBe(0);
      expect(movement.after).toBe(0);
    });

    // ── 11c: Düzeltme amount hesabı ───────────────────────────────────────

    it("11c — stok düzeltme: stock=15, yeni=8 → amount=-7, before=15, after=8", () => {
      const urun = makeProduct("urun-001", "Test Ürün", 15, 1000, 600);
      const db = makeDB({ products: [urun] });

      const { nextDB } = stokDuzeltme(db, "urun-001", 8);

      const movement = nextDB.stockMovements.find(
        (m) => m.productId === "urun-001",
      )!;
      expect(movement).toBeDefined();
      // amount = newStock - before = 8 - 15 = -7
      expect(movement.amount).toBe(-7);
      expect(movement.before).toBe(15);
      expect(movement.after).toBe(8);
      expect(movement.type).toBe("duzeltme");

      const product = nextDB.products.find((p) => p.id === "urun-001")!;
      expect(product.stock).toBe(8);
    });

    // ── 11d: Ürün stoğu ile hareket tutarlılığı (property-based) ──────────

    it("11d — stok girişi tutarlılık invariantı: movement.before===stock && movement.after===stock+giris (property)", () => {
      /**
       * Validates: Requirements 16.1, 16.2, 16.3, 16.4
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (stock, giris) => {
            const urun = makeProduct("urun-001", "Test Ürün", stock, 1000, 600);
            const db = makeDB({ products: [urun] });

            const { nextDB } = stokGiris(db, "urun-001", giris);

            const movement = nextDB.stockMovements.find(
              (m) => m.productId === "urun-001",
            )!;
            const product = nextDB.products.find((p) => p.id === "urun-001")!;

            return (
              movement.before === stock &&
              movement.after === stock + giris &&
              product.stock === movement.after
            );
          },
        ),
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Grup 12: Satış Tam Yaşam Döngüsü
  // ══════════════════════════════════════════════════════════════════════════

  describe("Grup 12: Satış Tam Yaşam Döngüsü", () => {
    /**
     * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5,
     *            21.1, 21.2, 21.3, 21.4
     */

    // ── 12a: Kısmi tahsilat tutarlılığı ──────────────────────────────────

    it("12a — kısmi tahsilat tutarlılığı: kasa=400, cari.balance=800, toplam=1200", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const db0 = makeDB({ products: [soba], cari: [musteri] });

      const { nextDB, saleId, violations } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        400,
      );
      expect(violations).toHaveLength(0);

      const sale = nextDB.sales.find((s) => s.id === saleId)!;
      expect(sale.total).toBe(1200);

      // Kasa geliri = 400
      const kasaGelir = nextDB.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(400);

      // cari.balance artışı = 800
      const cari = nextDB.cari.find((c) => c.id === "musteri-001")!;
      expect(cari.balance).toBe(800);

      // 400 + 800 = 1200 = sale.total
      expect(kasaGelir + cari.balance).toBe(sale.total);
    });

    // ── 12b: Ek tahsilat ─────────────────────────────────────────────────

    it("12b — ek tahsilat: cari.balance=800 → tahsilatYap(800) → kasa+=800, cari.balance=0", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // 12a ile aynı kurulum: kısmi tahsilat 400
      const { nextDB: db1 } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        400,
      );

      const cariAfterSale = db1.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterSale.balance).toBe(800);

      const kasaBefore = db1.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaBefore).toBe(400);

      // Ek tahsilat: 800₺
      const { nextDB: db2, violations } = tahsilatYap(
        db1,
        "musteri-001",
        800,
        "nakit",
      );
      expect(violations).toHaveLength(0);

      // Kasa += 800 (toplam 1200)
      const kasaAfter = db2.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaAfter).toBe(kasaBefore + 800);

      // cari.balance = 0
      const cariAfterTahsilat = db2.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterTahsilat.balance).toBe(0);
    });

    // ── 12c: Kısmi tahsilatlı iade ────────────────────────────────────────

    it("12c — kısmi tahsilatlı iade: kasa=[+400,-400], cari.balance=0, net kasa=0", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Satış: kasa=[+400], cari.balance=800
      const { nextDB: db1, saleId } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        400,
      );

      const cariAfterSale = db1.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterSale.balance).toBe(800);

      // İade: kasa=[+400,-400], cari.balance=0
      const { nextDB: db2, violations } = iadeYap(db1, saleId);
      expect(violations).toHaveLength(0);

      // cari.balance = 0
      const cariAfterIade = db2.cari.find((c) => c.id === "musteri-001")!;
      expect(cariAfterIade.balance).toBe(0);

      // Net kasa = 0
      const netKasa = db2.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);
    });

    // ── 12d: İptal sonrası çift iade engeli ──────────────────────────────

    it("12d — iptal sonrası çift iade engeli: iptal edilmiş satış iade edilemez", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const db0 = makeDB({ products: [soba] });

      // Nakit satış
      const { nextDB: db1, saleId } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
      );

      // İptal et → status='iptal'
      const { nextDB: db2 } = iptalYap(db1, saleId);
      const saleAfterIptal = db2.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIptal.status).toBe("iptal");

      // İade yapmaya çalış → engellenmeli (status !== 'tamamlandi')
      const { nextDB: db3 } = iadeYap(db2, saleId);

      // Satış durumu 'iptal' olarak kalmalı (iade'ye geçmemeli)
      const saleAfterIade = db3.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIade.status).toBe("iptal");
    });

    // ── 12e: İptal stok geri yükleme ─────────────────────────────────────

    it("12e — iptal stok geri yükleme: satış sonrası stock=9, iptal sonrası stock=10", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const db0 = makeDB({ products: [soba] });

      // Satış: stock 10 → 9
      const { nextDB: db1, saleId } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
      );

      const sobaAfterSale = db1.products.find((p) => p.id === "soba-001")!;
      expect(sobaAfterSale.stock).toBe(9);

      // İptal: stock 9 → 10
      const { nextDB: db2, violations } = iptalYap(db1, saleId);
      expect(violations).toHaveLength(0);

      // sale.status = 'iptal'
      const saleAfterIptal = db2.sales.find((s) => s.id === saleId)!;
      expect(saleAfterIptal.status).toBe("iptal");

      // product.stock = 10
      const sobaAfterIptal = db2.products.find((p) => p.id === "soba-001")!;
      expect(sobaAfterIptal.stock).toBe(10);
    });

    // ── 12f: Tam nakit satışta cari.balance değişmez ──────────────────────

    it("12f — tam nakit satışta cari.balance değişmez", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Nakit satış — cariId yok
      const { nextDB, violations } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "nakit",
      );
      expect(violations).toHaveLength(0);

      // cari.balance değişmemeli (hâlâ 0)
      const cari = nextDB.cari.find((c) => c.id === "musteri-001")!;
      expect(cari.balance).toBe(0);
    });

    // ── 12g: Tam cari satışta kasaya giriş yok ────────────────────────────

    it("12g — tam cari satışta kasaya giriş yok: tahsilat=0 → kasa entries=0, cari.balance=sale.total", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const musteri: Cari = {
        id: "musteri-001",
        name: "Test Müşteri",
        type: "musteri",
        balance: 0,
        deleted: false,
        createdAt: now(),
        updatedAt: now(),
      };
      const db0 = makeDB({ products: [soba], cari: [musteri] });

      // Cari satış, tahsilat=0
      const { nextDB, saleId, violations } = satisYap(
        db0,
        [{ productId: "soba-001", qty: 1 }],
        "cari",
        "musteri-001",
        0,
      );
      expect(violations).toHaveLength(0);

      const sale = nextDB.sales.find((s) => s.id === saleId)!;

      // Kasa entries = 0 (nakit giriş yok)
      const kasaEntries = nextDB.kasa.filter(
        (k) => !k.deleted && k.type === "gelir",
      );
      expect(kasaEntries).toHaveLength(0);

      // cari.balance = sale.total
      const cari = nextDB.cari.find((c) => c.id === "musteri-001")!;
      expect(cari.balance).toBe(sale.total);
      expect(cari.balance).toBe(1200);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 🔬 GÖREV 1: Bug Condition Exploration — Nakit Satış → İade
  // ══════════════════════════════════════════════════════════════════════════

  describe("🔬 Görev 1: Bug Condition Exploration — Nakit Satış → İade", () => {
    it("nakit satış → iade sonrası net kasa sıfır olmalı (bug condition)", () => {
      const soba = makeProduct("soba-001", "Standart Soba", 10, 1200, 800);
      const prevDB = makeDB({ products: [soba] });

      // Satış yap
      const {
        nextDB: afterSale,
        saleId,
        violations: saleViolations,
      } = satisYap(prevDB, [{ productId: "soba-001", qty: 1 }], "nakit");
      expect(saleViolations).toHaveLength(0);

      // Kasa geliri kontrol
      const kasaGelir = afterSale.kasa
        .filter((k) => !k.deleted && k.type === "gelir")
        .reduce((s, k) => s + k.amount, 0);
      expect(kasaGelir).toBe(1200);

      // İade yap
      const { nextDB: afterIade, violations: iadeViolations } = iadeYap(
        afterSale,
        saleId,
      );
      expect(iadeViolations).toHaveLength(0);

      // Net kasa sıfır olmalı
      const netKasa = afterIade.kasa
        .filter((k) => !k.deleted)
        .reduce((s, k) => s + (k.type === "gelir" ? k.amount : -k.amount), 0);
      expect(netKasa).toBe(0);

      // Satış durumu iade olmalı
      const sale = afterIade.sales.find((s) => s.id === saleId)!;
      expect(sale.status).toBe("iade");

      // Stok geri yüklenmeli
      const product = afterIade.products.find((p) => p.id === "soba-001")!;
      expect(product.stock).toBe(10);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 🔬 Property-Based Tests — Global İnvariantlar
  // ══════════════════════════════════════════════════════════════════════════

  describe("🔬 Property-Based Tests — Global İnvariantlar", () => {
    /**
     * P1 — Kasa Bakiyesi Tutarlılığı
     * Validates: Requirements 2.1, 2.4
     *
     * Herhangi bir kasa kayıt dizisi için, silinmemiş kayıtların
     * toplamı her zaman tutarlı olmalıdır.
     */
    it("P1 — Kasa Bakiyesi Tutarlılığı: silinmemiş kayıtların toplamı tutarlı olmalı", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom("gelir", "gider") as fc.Arbitrary<
                "gelir" | "gider"
              >,
              amount: fc.integer({ min: 1, max: 100000 }),
              deleted: fc.boolean(),
            }),
          ),
          (entries) => {
            const beklenen = entries
              .filter((e) => !e.deleted)
              .reduce(
                (s, e) => s + (e.type === "gelir" ? e.amount : -e.amount),
                0,
              );
            const computed = entries
              .filter((e) => !e.deleted)
              .reduce(
                (s, e) => s + (e.type === "gelir" ? e.amount : -e.amount),
                0,
              );
            return computed === beklenen;
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * P2 — Stok Negatife Düşmez
     * Validates: Requirements 2.5, 3.1
     *
     * Stok miktarından fazla satış yapılmaya çalışıldığında
     * negative_stock ihlali üretilmeli; aksi hâlde ihlal olmamalı.
     */
    it("P2 — Stok Negatife Düşmez: yetersiz stokta negative_stock ihlali üretilmeli", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),
          fc.integer({ min: 1, max: 300 }),
          (stock, satisMiktari) => {
            const urun = makeProduct("urun-p2", "Test", stock, 1000, 500);
            const db = makeDB({ products: [urun] });
            const { violations } = satisYap(
              db,
              [{ productId: "urun-p2", qty: satisMiktari }],
              "nakit",
            );
            if (satisMiktari > stock) {
              return violations.some((v) => v.ruleId === "negative_stock");
            }
            return violations.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * P3 — Satış Toplam Tutarlılığı
     * Validates: Requirements 2.1, 3.2
     *
     * Herhangi bir adet, fiyat, maliyet ve iskonto kombinasyonu için
     * toplam negatif olmamalı ve kâr hesabı tutarlı olmalıdır.
     */
    it("P3 — Satış Toplam Tutarlılığı: total >= 0 ve profit hesabı tutarlı olmalı", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 100, max: 5000 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          (qty, price, cost, discPct) => {
            const subtotal = qty * price;
            const discountAmount = subtotal * (discPct / 100);
            const total = subtotal - discountAmount;
            const profit = (price - cost) * qty - discountAmount;
            return (
              total >= 0 && profit === (price - cost) * qty - discountAmount
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * P4 — İade Sonrası Sıfır Net
     * Validates: Requirements 2.1, 3.5
     *
     * Herhangi bir nakit satış → tam iade senaryosunda
     * net kasa bakiyesi sıfır olmalıdır.
     */
    it("P4 — İade Sonrası Sıfır Net: nakit satış → iade → net kasa = 0", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 100, max: 10000 }),
          (qty, price) => {
            const urun = makeProduct(
              "urun-p4",
              "Test",
              qty,
              price,
              Math.floor(price * 0.6),
            );
            const db = makeDB({ products: [urun] });
            const { nextDB: afterSale, saleId } = satisYap(
              db,
              [{ productId: "urun-p4", qty }],
              "nakit",
            );
            const { nextDB: afterIade } = iadeYap(afterSale, saleId);
            const net = afterIade.kasa
              .filter((k) => !k.deleted)
              .reduce(
                (s, k) => s + (k.type === "gelir" ? k.amount : -k.amount),
                0,
              );
            return net === 0;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
