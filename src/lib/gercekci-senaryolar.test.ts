/**
 * 🔍 Gerçekçi Senaryo Testleri
 *
 * Farklı iş akışlarını ve kenar durumlarını kapsayan senaryolar:
 *  1. Çok müşterili gün sonu özeti
 *  2. İskontolu satış ve kâr hesabı
 *  3. Stok tükenmesi + tedarik döngüsü
 *  4. Karma ödeme yöntemleri ve kasa bağımsızlığı
 *
 * Pattern: prevDB → işlem → nextDB, rule engine her adımda çalışır.
 */

import { describe, it, expect } from 'vitest';
import { validateTransaction, TRANSACTION_LIMIT } from './ruleEngine';
import type { DB, Product, Sale, KasaEntry, Cari, StockMovement } from '@/types';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
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

function makeProduct(
  id: string,
  name: string,
  stock: number,
  price: number,
  cost: number
): Product {
  return {
    id,
    name,
    category: 'soba',
    cost,
    price,
    stock,
    minStock: 3,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

function makeCari(id: string, name: string, balance = 0): Cari {
  return {
    id,
    name,
    type: 'musteri',
    balance,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

/**
 * Nakit / banka satışı — isteğe bağlı iskonto destekli
 * iskonto: { tip: 'yuzde' | 'tutar'; deger: number }
 */
function satisYap(
  prevDB: DB,
  productId: string,
  adet: number,
  odeme: 'nakit' | 'banka',
  iskonto?: { tip: 'yuzde' | 'tutar'; deger: number }
): { nextDB: DB; violations: ReturnType<typeof validateTransaction>; saleId: string } {
  const product = prevDB.products.find(p => p.id === productId)!;
  const saleId = genId();
  const nowIso = now();

  const subtotal = product.price * adet;
  let discountAmount = 0;
  let discountNum = 0;
  if (iskonto) {
    discountNum = iskonto.deger;
    discountAmount =
      iskonto.tip === 'yuzde' ? subtotal * (iskonto.deger / 100) : iskonto.deger;
  }
  const total = Math.max(0, subtotal - discountAmount);
  const profit =
    (product.price - product.cost) * adet - discountAmount;

  const sale: Sale = {
    id: saleId,
    productId: product.id,
    productName: product.name,
    productCategory: product.category,
    quantity: adet,
    unitPrice: product.price,
    cost: product.cost,
    discount: discountNum,
    discountAmount,
    subtotal,
    total,
    profit,
    payment: odeme,
    status: 'tamamlandi',
    items: [{
      productId: product.id,
      productName: product.name,
      quantity: adet,
      unitPrice: product.price,
      cost: product.cost,
      total: product.price * adet,
    }],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const kasaEntry: KasaEntry = {
    id: genId(),
    type: 'gelir',
    category: 'satis',
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
    type: 'satis',
    amount: -adet,
    before: product.stock,
    after: product.stock - adet,
    note: `Satış x${adet}`,
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    sales: [...prevDB.sales, sale],
    products: prevDB.products.map(p =>
      p.id === productId ? { ...p, stock: p.stock - adet, updatedAt: nowIso } : p
    ),
    kasa: [...prevDB.kasa, kasaEntry],
    stockMovements: [...prevDB.stockMovements, stokHareket],
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

/** Cari satış (veresiye) */
function cariSatisYap(
  prevDB: DB,
  productId: string,
  adet: number,
  cariId: string
): { nextDB: DB; violations: ReturnType<typeof validateTransaction>; saleId: string } {
  const product = prevDB.products.find(p => p.id === productId)!;
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
    cariName: prevDB.cari.find(c => c.id === cariId)?.name,
    quantity: adet,
    unitPrice: product.price,
    cost: product.cost,
    discount: 0,
    discountAmount: 0,
    subtotal: total,
    total,
    profit,
    payment: 'cari',
    status: 'tamamlandi',
    items: [{
      productId: product.id,
      productName: product.name,
      quantity: adet,
      unitPrice: product.price,
      cost: product.cost,
      total,
    }],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const stokHareket: StockMovement = {
    id: genId(),
    productId: product.id,
    productName: product.name,
    type: 'satis',
    amount: -adet,
    before: product.stock,
    after: product.stock - adet,
    note: `Cari satış x${adet}`,
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    sales: [...prevDB.sales, sale],
    products: prevDB.products.map(p =>
      p.id === productId ? { ...p, stock: p.stock - adet, updatedAt: nowIso } : p
    ),
    kasa: prevDB.kasa,
    stockMovements: [...prevDB.stockMovements, stokHareket],
    cari: prevDB.cari.map(c =>
      c.id === cariId
        ? { ...c, balance: (c.balance || 0) + total, lastTransaction: nowIso, updatedAt: nowIso }
        : c
    ),
  };

  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations, saleId };
}

/** Stok girişi (mal alımı) */
function stokGiris(
  prevDB: DB,
  productId: string,
  adet: number
): { nextDB: DB } {
  const nowIso = now();
  const product = prevDB.products.find(p => p.id === productId)!;

  const stokHareket: StockMovement = {
    id: genId(),
    productId: product.id,
    productName: product.name,
    type: 'giris',
    amount: adet,
    before: product.stock,
    after: product.stock + adet,
    note: `Mal alımı x${adet}`,
    date: nowIso,
  };

  const nextDB: DB = {
    ...prevDB,
    products: prevDB.products.map(p =>
      p.id === productId ? { ...p, stock: p.stock + adet, updatedAt: nowIso } : p
    ),
    stockMovements: [...prevDB.stockMovements, stokHareket],
  };
  return { nextDB };
}

/** Tahsilat */
function tahsilatYap(
  prevDB: DB,
  cariId: string,
  amount: number,
  kasa: 'nakit' | 'banka'
): { nextDB: DB; violations: ReturnType<typeof validateTransaction> } {
  const nowIso = now();
  const kasaEntry: KasaEntry = {
    id: genId(),
    type: 'gelir',
    category: 'tahsilat',
    amount,
    kasa,
    description: `Tahsilat: ${prevDB.cari.find(c => c.id === cariId)?.name || cariId}`,
    cariId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const nextDB: DB = {
    ...prevDB,
    kasa: [...prevDB.kasa, kasaEntry],
    cari: prevDB.cari.map(c =>
      c.id === cariId
        ? { ...c, balance: (c.balance || 0) - amount, lastTransaction: nowIso, updatedAt: nowIso }
        : c
    ),
  };
  const violations = validateTransaction(prevDB, nextDB);
  return { nextDB, violations };
}

function kasaBakiyesi(db: DB, kasaId: string): number {
  return db.kasa
    .filter(k => !k.deleted && k.kasa === kasaId)
    .reduce((s, k) => s + (k.type === 'gelir' ? k.amount : -k.amount), 0);
}

// ─── TESTLER ──────────────────────────────────────────────────────────────────

describe('🔍 Gerçekçi Senaryo Testleri', () => {

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 1: Çok müşterili gün sonu özeti
  // ══════════════════════════════════════════════════════════════════════════

  describe('Senaryo 1: Çok müşterili gün — 5 farklı müşteri', () => {
    const soba = makeProduct('soba-001', 'Standart Soba', 50, 1_200, 800);
    const musteriAhmet = makeCari('cari-ahmet', 'Ahmet Yılmaz');
    const musteriFatma = makeCari('cari-fatma', 'Fatma Kaya');
    const musteriMehmet = makeCari('cari-mehmet', 'Mehmet Demir');

    let db = makeDB({
      products: [soba],
      cari: [musteriAhmet, musteriFatma, musteriMehmet],
    });

    const allViolations: ReturnType<typeof validateTransaction> = [];

    // Ahmet: 2 nakit
    const s1 = satisYap(db, 'soba-001', 2, 'nakit');
    allViolations.push(...s1.violations); db = s1.nextDB;

    // Fatma: 3 banka
    const s2 = satisYap(db, 'soba-001', 3, 'banka');
    allViolations.push(...s2.violations); db = s2.nextDB;

    // Mehmet: 5 veresiye
    const s3 = cariSatisYap(db, 'soba-001', 5, 'cari-mehmet');
    allViolations.push(...s3.violations); db = s3.nextDB;

    // Ahmet tekrar: 1 nakit
    const s4 = satisYap(db, 'soba-001', 1, 'nakit');
    allViolations.push(...s4.violations); db = s4.nextDB;

    // Fatma tekrar: 2 banka
    const s5 = satisYap(db, 'soba-001', 2, 'banka');
    allViolations.push(...s5.violations); db = s5.nextDB;

    // Mehmet tahsilat: 3000
    const t1 = tahsilatYap(db, 'cari-mehmet', 3_000, 'nakit');
    allViolations.push(...t1.violations); db = t1.nextDB;

    it('gün boyunca kural ihlali olmamalı', () => {
      expect(allViolations).toHaveLength(0);
    });

    it('toplam 13 soba satılmış olmalı (2+3+5+1+2)', () => {
      const toplamAdet = db.sales.reduce((s, sale) => s + sale.quantity, 0);
      expect(toplamAdet).toBe(13);
    });

    it('stok 50 → 37 olmalı', () => {
      expect(db.products.find(p => p.id === 'soba-001')!.stock).toBe(37);
    });

    it('nakit kasa: (2+1)×1200 + 3000 (tahsilat) = 6600 ₺', () => {
      expect(kasaBakiyesi(db, 'nakit')).toBe(6_600);
    });

    it('banka kasa: (3+2)×1200 = 6000 ₺', () => {
      expect(kasaBakiyesi(db, 'banka')).toBe(6_000);
    });

    it('Mehmet bakiyesi: 5×1200 - 3000 = 3000 ₺', () => {
      const cari = db.cari.find(c => c.id === 'cari-mehmet')!;
      expect(cari.balance).toBe(3_000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 2: İskontolu satış ve kâr hesabı
  // ══════════════════════════════════════════════════════════════════════════

  describe('Senaryo 2: İskontolu satış — yüzde ve tutar iskontosu', () => {
    const soba = makeProduct('soba-001', 'Standart Soba', 10, 1_000, 600);
    const db0 = makeDB({ products: [soba] });

    // %10 iskonto
    const { nextDB: db1, violations: v1, saleId: saleId1 } =
      satisYap(db0, 'soba-001', 2, 'nakit', { tip: 'yuzde', deger: 10 });

    // 150 ₺ tutar iskontosu
    const { nextDB: db2, violations: v2, saleId: saleId2 } =
      satisYap(db1, 'soba-001', 2, 'nakit', { tip: 'tutar', deger: 150 });

    it('%10 iskontolu satış — kural ihlali olmamalı', () => {
      expect(v1).toHaveLength(0);
    });

    it('%10 iskonto: subtotal=2000, discountAmount=200, total=1800', () => {
      const sale = db1.sales.find(s => s.id === saleId1)!;
      expect(sale.subtotal).toBe(2_000);
      expect(sale.discountAmount).toBe(200);
      expect(sale.total).toBe(1_800);
    });

    it('%10 iskontolu kâr: (1000-600)×2 - 200 = 600 ₺', () => {
      const sale = db1.sales.find(s => s.id === saleId1)!;
      expect(sale.profit).toBe(600);
    });

    it('150 ₺ tutar iskontolu satış — kural ihlali olmamalı', () => {
      expect(v2).toHaveLength(0);
    });

    it('150 ₺ tutar iskontosu: subtotal=2000, discountAmount=150, total=1850', () => {
      const sale = db2.sales.find(s => s.id === saleId2)!;
      expect(sale.subtotal).toBe(2_000);
      expect(sale.discountAmount).toBe(150);
      expect(sale.total).toBe(1_850);
    });

    it('150 ₺ iskontolu kâr: (1000-600)×2 - 150 = 650 ₺', () => {
      const sale = db2.sales.find(s => s.id === saleId2)!;
      expect(sale.profit).toBe(650);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 3: Stok tükenmesi + mal alımı → yeni satış döngüsü
  // ══════════════════════════════════════════════════════════════════════════

  describe('Senaryo 3: Stok tükenmesi → mal alımı → satış döngüsü', () => {
    const soba = makeProduct('soba-001', 'Standart Soba', 3, 1_200, 800);
    let db = makeDB({ products: [soba] });

    // 3 soba sat — stok tamamen biter
    const s1 = satisYap(db, 'soba-001', 3, 'nakit');
    db = s1.nextDB;

    // 4. satış girişimi — stok yok, engellenmeli
    const s2 = satisYap(db, 'soba-001', 1, 'nakit');

    // Mal alımı: 10 soba
    const { nextDB: db3 } = stokGiris(db, 'soba-001', 10);
    db = db3;

    // Mal alımı sonrası satış
    const s3 = satisYap(db, 'soba-001', 5, 'nakit');
    db = s3.nextDB;

    it('3 satış kural ihlalsiz tamamlanmalı', () => {
      expect(s1.violations).toHaveLength(0);
    });

    it('stok tükendikten sonra satış negative_stock üretmeli', () => {
      expect(s2.violations.some(v => v.ruleId === 'negative_stock')).toBe(true);
    });

    it('mal alımı sonrası stok 0 + 10 = 10 olmalı', () => {
      expect(db3.products.find(p => p.id === 'soba-001')!.stock).toBe(10);
    });

    it('mal alımı sonrası satış kural ihlalsiz tamamlanmalı', () => {
      expect(s3.violations).toHaveLength(0);
    });

    it('son stok 10 - 5 = 5 olmalı', () => {
      expect(db.products.find(p => p.id === 'soba-001')!.stock).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 4: Karma ödeme yöntemleri — kasa bağımsızlığı
  // ══════════════════════════════════════════════════════════════════════════

  describe('Senaryo 4: Karma ödeme — nakit ve banka kasaları bağımsız', () => {
    const urun = makeProduct('u001', 'Test Ürün', 100, 500, 300);
    let db = makeDB({ products: [urun] });
    const allViolations: ReturnType<typeof validateTransaction> = [];

    // 10 nakit satış × 500 = 5000
    for (let i = 0; i < 10; i++) {
      const { nextDB, violations } = satisYap(db, 'u001', 1, 'nakit');
      allViolations.push(...violations);
      db = nextDB;
    }

    // 5 banka satışı × 500 = 2500
    for (let i = 0; i < 5; i++) {
      const { nextDB, violations } = satisYap(db, 'u001', 1, 'banka');
      allViolations.push(...violations);
      db = nextDB;
    }

    it('15 satışın hiçbirinde kural ihlali olmamalı', () => {
      expect(allViolations).toHaveLength(0);
    });

    it('nakit kasa: 10 × 500 = 5000 ₺', () => {
      expect(kasaBakiyesi(db, 'nakit')).toBe(5_000);
    });

    it('banka kasa: 5 × 500 = 2500 ₺', () => {
      expect(kasaBakiyesi(db, 'banka')).toBe(2_500);
    });

    it('nakit ve banka kasaları birbirinden bağımsız', () => {
      expect(kasaBakiyesi(db, 'nakit') + kasaBakiyesi(db, 'banka')).toBe(7_500);
    });

    it('stok 100 - 15 = 85 olmalı', () => {
      expect(db.products.find(p => p.id === 'u001')!.stock).toBe(85);
    });

    it('toplam kâr: 15 × 200 = 3000 ₺', () => {
      const toplamKar = db.sales.reduce((s, sale) => s + sale.profit, 0);
      expect(toplamKar).toBe(3_000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Senaryo 5: TRANSACTION_LIMIT sabitinin değeri
  // ══════════════════════════════════════════════════════════════════════════

  describe('Senaryo 5: TRANSACTION_LIMIT sabiti 100.000 ₺ olarak tanımlı', () => {
    it('TRANSACTION_LIMIT 100_000 ₺ olmalı', () => {
      expect(TRANSACTION_LIMIT).toBe(100_000);
    });
  });

});
