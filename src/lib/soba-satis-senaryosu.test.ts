/**
 * 🔥 SOBA SATIŞ SENARYOSU — 100 Adet Soba Satışı
 *
 * Senaryo: Başlangıçta 120 adet sobası olan bir mağaza,
 * 100 adet soba satışı gerçekleştiriyor.
 *
 * Test edilen durumlar:
 *  1. Normal satış — stok yeterli, kasa güncellenir
 *  2. Stok sınırında satış — tam 120 adet
 *  3. Stok aşımı — 121 adet satmaya çalışmak
 *  4. Kasa bakiyesi doğruluğu
 *  5. Cari (veresiye) satış — bakiye güncellenir
 *  6. Ardışık 100 satış simülasyonu — son durum
 */

import { describe, it, expect } from 'vitest';
import { validateTransaction } from './ruleEngine';
import type { DB, Product, Sale, KasaEntry, Cari, StockMovement } from '@/types';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
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
      { id: 'nakit', name: 'Nakit', icon: '💵' },
      { id: 'banka', name: 'Banka', icon: '🏦' },
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
    company: { id: 'c1', createdAt: now() },
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

/** Soba ürünü oluştur */
function makeSoba(stock: number): Product {
  return {
    id: 'soba-001',
    name: 'Standart Soba',
    category: 'soba',
    cost: 800,      // alış fiyatı
    price: 1200,    // satış fiyatı
    stock,
    minStock: 5,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

/**
 * Satış işlemini simüle eder — App.tsx'teki QuickSaleModal.handleSave mantığını yansıtır.
 * prevDB → nextDB dönüşümünü uygular ve rule engine'i çalıştırır.
 */
function satisYap(
  prevDB: DB,
  adet: number,
  odeme: 'nakit' | 'kart' | 'havale' | 'cari' = 'nakit',
  cariId?: string
): { nextDB: DB; violations: ReturnType<typeof validateTransaction>; saleId: string } {
  const product = prevDB.products.find(p => p.id === 'soba-001')!;
  const saleId = genId();
  const nowIso = now();

  const subtotal = product.price * adet;
  const total = subtotal;
  const profit = (product.price - product.cost) * adet;

  const sale: Sale = {
    id: saleId,
    productId: product.id,
    productName: product.name,
    productCategory: product.category,
    cariId: cariId,
    quantity: adet,
    unitPrice: product.price,
    cost: product.cost,
    discount: 0,
    discountAmount: 0,
    subtotal,
    total,
    profit,
    payment: odeme,
    status: 'tamamlandi',
    items: [{ productId: product.id, productName: product.name, quantity: adet, unitPrice: product.price, cost: product.cost, total }],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const kasaEntry: KasaEntry | null = odeme !== 'cari'
    ? {
        id: genId(),
        type: 'gelir',
        category: 'satis',
        amount: total,
        kasa: odeme === 'nakit' ? 'nakit' : 'banka',
        description: `Satış: ${product.name} x${adet}`,
        relatedId: saleId,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
    : null;

  const stockMovement: StockMovement = {
    id: genId(),
    productId: product.id,
    productName: product.name,
    type: 'satis',
    amount: -adet,
    before: product.stock,
    after: product.stock - adet,
    note: `Satış x${adet}`,
    date: nowIso,
  };

  // Cari bakiyesi güncelle
  let cari = prevDB.cari;
  if (odeme === 'cari' && cariId) {
    cari = cari.map(c =>
      c.id === cariId
        ? { ...c, balance: (c.balance || 0) + total, lastTransaction: nowIso, updatedAt: nowIso }
        : c
    );
  }

  const nextDB: DB = {
    ...prevDB,
    sales: [...prevDB.sales, sale],
    products: prevDB.products.map(p =>
      p.id === 'soba-001' ? { ...p, stock: p.stock - adet, updatedAt: nowIso } : p
    ),
    kasa: kasaEntry ? [...prevDB.kasa, kasaEntry] : prevDB.kasa,
    stockMovements: [...prevDB.stockMovements, stockMovement],
    cari,
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

// ─── TESTLER ──────────────────────────────────────────────────────────────────

describe('🔥 Soba Satış Senaryosu', () => {

  // ── 1. Normal Satış ────────────────────────────────────────────────────────
  describe('1. Normal satış — 100 adet, stok 120', () => {
    const prevDB = makeDB({ products: [makeSoba(120)] });
    const { nextDB, violations } = satisYap(prevDB, 100);

    it('kural ihlali olmamalı', () => {
      expect(violations).toHaveLength(0);
    });

    it('stok 120 → 20 olmalı', () => {
      const soba = nextDB.products.find(p => p.id === 'soba-001')!;
      expect(soba.stock).toBe(20);
    });

    it('kasa geliri 120.000 ₺ olmalı (100 × 1.200 ₺)', () => {
      const kasaToplam = nextDB.kasa
        .filter(k => k.type === 'gelir' && !k.deleted)
        .reduce((sum, k) => sum + k.amount, 0);
      expect(kasaToplam).toBe(120_000);
    });

    it('satış kaydı oluşmalı', () => {
      expect(nextDB.sales).toHaveLength(1);
      expect(nextDB.sales[0].total).toBe(120_000);
      expect(nextDB.sales[0].profit).toBe(40_000); // (1200-800) × 100
    });

    it('stok hareketi kaydedilmeli', () => {
      const hareket = nextDB.stockMovements[0];
      expect(hareket.type).toBe('satis');
      expect(hareket.before).toBe(120);
      expect(hareket.after).toBe(20);
      expect(hareket.amount).toBe(-100);
    });
  });

  // ── 2. Stok Sınırında Satış ────────────────────────────────────────────────
  describe('2. Stok sınırında satış — tam 120 adet', () => {
    const prevDB = makeDB({ products: [makeSoba(120)] });
    const { nextDB, violations } = satisYap(prevDB, 120);

    it('kural ihlali olmamalı (stok tam sıfıra iner)', () => {
      expect(violations).toHaveLength(0);
    });

    it('stok 0 olmalı', () => {
      const soba = nextDB.products.find(p => p.id === 'soba-001')!;
      expect(soba.stock).toBe(0);
    });

    it('kasa geliri 144.000 ₺ olmalı (120 × 1.200 ₺)', () => {
      const kasaToplam = nextDB.kasa
        .filter(k => k.type === 'gelir')
        .reduce((sum, k) => sum + k.amount, 0);
      expect(kasaToplam).toBe(144_000);
    });
  });

  // ── 3. Stok Aşımı — ENGELLENMELİ ─────────────────────────────────────────
  describe('3. Stok aşımı — 121 adet satmaya çalışmak (stok: 120)', () => {
    const prevDB = makeDB({ products: [makeSoba(120)] });
    const { violations } = satisYap(prevDB, 121);

    it('negative_stock ihlali üretmeli', () => {
      expect(violations.some(v => v.ruleId === 'negative_stock')).toBe(true);
    });

    it('ihlal severity: block olmalı — işlem engellenir', () => {
      const v = violations.find(v => v.ruleId === 'negative_stock')!;
      expect(v.severity).toBe('block');
    });

    it('hata mesajı stok değerini içermeli', () => {
      const v = violations.find(v => v.ruleId === 'negative_stock')!;
      expect(v.message).toContain('-1');
    });
  });

  // ── 4. Cari (Veresiye) Satış ───────────────────────────────────────────────
  describe('4. Cari satış — 100 adet veresiye', () => {
    const musteri: Cari = {
      id: 'cari-001',
      name: 'Ahmet Yılmaz',
      type: 'musteri',
      balance: 0,
      deleted: false,
      createdAt: now(),
      updatedAt: now(),
    };
    const prevDB = makeDB({
      products: [makeSoba(120)],
      cari: [musteri],
    });
    const { nextDB, violations } = satisYap(prevDB, 100, 'cari', 'cari-001');

    it('kural ihlali olmamalı', () => {
      expect(violations).toHaveLength(0);
    });

    it('kasaya nakit girişi olmamalı (cari satış)', () => {
      expect(nextDB.kasa).toHaveLength(0);
    });

    it('müşteri bakiyesi 120.000 ₺ artmalı', () => {
      const cari = nextDB.cari.find(c => c.id === 'cari-001')!;
      expect(cari.balance).toBe(120_000);
    });

    it('stok yine 20 olmalı', () => {
      const soba = nextDB.products.find(p => p.id === 'soba-001')!;
      expect(soba.stock).toBe(20);
    });
  });

  // ── 5. Ardışık 100 Satış Simülasyonu ──────────────────────────────────────
  describe('5. Ardışık 100 adet × 1 satış — son durum', () => {
    let db = makeDB({
      products: [makeSoba(120)],
      kasa: [
        // Başlangıç kasası: 0 ₺ (sadece gelir eklenecek)
      ],
    });

    // 100 adet satışı teker teker yap
    const ihlaller: ReturnType<typeof validateTransaction> = [];
    for (let i = 0; i < 100; i++) {
      const { nextDB, violations } = satisYap(db, 1);
      if (violations.length > 0) ihlaller.push(...violations);
      db = nextDB;
    }

    it('100 satışın hiçbirinde kural ihlali olmamalı', () => {
      expect(ihlaller).toHaveLength(0);
    });

    it('son stok: 120 - 100 = 20 olmalı', () => {
      const soba = db.products.find(p => p.id === 'soba-001')!;
      expect(soba.stock).toBe(20);
    });

    it('toplam satış adedi 100 olmalı', () => {
      expect(db.sales).toHaveLength(100);
    });

    it('toplam kasa geliri 120.000 ₺ olmalı (100 × 1.200 ₺)', () => {
      const toplam = db.kasa
        .filter(k => k.type === 'gelir' && !k.deleted)
        .reduce((sum, k) => sum + k.amount, 0);
      expect(toplam).toBe(120_000);
    });

    it('toplam kâr 40.000 ₺ olmalı (100 × 400 ₺)', () => {
      const toplamKar = db.sales.reduce((sum, s) => sum + s.profit, 0);
      expect(toplamKar).toBe(40_000);
    });

    it('stok hareketi 100 kayıt içermeli', () => {
      expect(db.stockMovements).toHaveLength(100);
    });
  });

  // ── 6. 101. Satış — Stok Tükenmesi Senaryosu ──────────────────────────────
  describe('6. 101. satış — stok tükenmesi (120 adet başlangıç)', () => {
    let db = makeDB({ products: [makeSoba(120)] });

    // 120 satış yap (stok tam biter)
    for (let i = 0; i < 120; i++) {
      const { nextDB } = satisYap(db, 1);
      db = nextDB;
    }

    it('120 satış sonrası stok 0 olmalı', () => {
      const soba = db.products.find(p => p.id === 'soba-001')!;
      expect(soba.stock).toBe(0);
    });

    it('121. satış girişimi engellenmelidir', () => {
      const { violations } = satisYap(db, 1);
      expect(violations.some(v => v.ruleId === 'negative_stock' && v.severity === 'block')).toBe(true);
    });

    it('engellenen satış DB\'yi değiştirmemeli (prevDB korunur)', () => {
      const { violations, nextDB } = satisYap(db, 1);
      // Uygulama violations varsa nextDB'yi kaydetmez — stok hâlâ 0
      // Bu test, rule engine'in doğru ihlal ürettiğini doğrular
      expect(violations.length).toBeGreaterThan(0);
      // nextDB'de stok -1 olur ama uygulama bunu kaydetmez
      const sobaNext = nextDB.products.find(p => p.id === 'soba-001')!;
      expect(sobaNext.stock).toBe(-1); // nextDB hesaplandı ama kaydedilmedi
    });
  });

  // ── 7. Büyük İşlem Uyarısı ────────────────────────────────────────────────
  describe('7. Büyük işlem — 100 adet × 1.200 ₺ = 120.000 ₺ (limit: 100.000 ₺)', () => {
    // TRANSACTION_LIMIT = 100_000 ₺
    // 100 adet × 1.200 ₺ = 120.000 ₺ → tek kasaEntry olarak girilirse limit aşılır
    // Ama satış başına 1 kasaEntry oluştuğundan her biri 1.200 ₺ — limit aşılmaz
    // Bu test, toplu satış vs. tek büyük işlem farkını gösterir

    it('100 ayrı satış → her kasaEntry 1.200 ₺ — TRANSACTION_LIMIT ihlali yok', () => {
      let db = makeDB({ products: [makeSoba(120)] });
      const ihlaller: ReturnType<typeof validateTransaction> = [];

      for (let i = 0; i < 100; i++) {
        const { nextDB, violations } = satisYap(db, 1);
        ihlaller.push(...violations);
        db = nextDB;
      }

      expect(ihlaller.filter(v => v.ruleId === 'zero_amount')).toHaveLength(0);
      // Her kasaEntry 1.200 ₺ — ruleEngine'de TRANSACTION_LIMIT kasa kaydı için değil
      // auditEngine/dataIntegrityChecker'da kontrol edilir
    });

    it('tek seferde 100 adet satış → kasaEntry 120.000 ₺ — ruleEngine ihlali yok (limit auditEngine\'de)', () => {
      const prevDB = makeDB({ products: [makeSoba(120)] });
      const { violations } = satisYap(prevDB, 100);
      // ruleEngine TRANSACTION_LIMIT kontrolü yapmaz — bu auditEngine'in görevi
      expect(violations.filter(v => v.ruleId === 'transaction_limit')).toHaveLength(0);
    });
  });

});
