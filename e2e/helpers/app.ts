import { expect, type Page } from '@playwright/test';

const baseSeedDb = {
  _version: 0,
  products: [
    {
      id: 'urun-1',
      name: 'Deneme Sobasi',
      category: 'soba',
      cost: 1200,
      price: 1800,
      stock: 8,
      minStock: 2,
      createdAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T09:00:00.000Z',
    },
    {
      id: 'urun-2',
      name: 'Boru Seti',
      category: 'boru',
      cost: 300,
      price: 500,
      stock: 12,
      minStock: 3,
      createdAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T09:00:00.000Z',
    },
  ],
  suppliers: [
    {
      id: 'sup-1',
      name: 'Test Tedarikci',
      category: 'Genel',
      phone: '05000000000',
      totalOrders: 0,
      totalAmount: 0,
      createdAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T09:00:00.000Z',
    },
  ],
  orders: [],
  cari: [
    {
      id: 'cari-1',
      name: 'Test Musterisi',
      type: 'musteri',
      balance: 0,
      phone: '05550000000',
      createdAt: '2026-05-06T09:00:00.000Z',
      updatedAt: '2026-05-06T09:00:00.000Z',
    },
  ],
  sales: [],
  kasa: [],
  stockMovements: [],
  bankTransactions: [],
  matchRules: [],
  monitorRules: [],
  monitorLog: [],
  peletSuppliers: [],
  peletOrders: [],
  boruSuppliers: [],
  boruOrders: [],
  invoices: [],
  budgets: [],
  returns: [],
  _activityLog: [],
  company: { id: 'company-1', createdAt: '2026-05-06T09:00:00.000Z' },
  settings: {},
  pelletSettings: { gramaj: 14, kgFiyat: 6.5, cuvalKg: 15, critDays: 3 },
  ortakEmanetler: [],
  installments: [],
  partners: [],
  productCategories: [
    { id: 'soba', name: 'Soba', icon: '🔥', createdAt: '2026-05-06T09:00:00.000Z' },
    { id: 'aksesuar', name: 'Aksesuar', icon: '🔧', createdAt: '2026-05-06T09:00:00.000Z' },
    { id: 'yedek', name: 'Yedek Parca', icon: '⚙️', createdAt: '2026-05-06T09:00:00.000Z' },
    { id: 'boru', name: 'Boru', icon: '🔩', createdAt: '2026-05-06T09:00:00.000Z' },
    { id: 'pelet', name: 'Pelet', icon: '🪵', createdAt: '2026-05-06T09:00:00.000Z' },
  ],
  notes: [],
  _auditLog: [],
  kasalar: [
    { id: 'nakit', name: 'Nakit', icon: '💵' },
    { id: 'banka', name: 'Banka', icon: '🏦' },
    { id: 'pos_ziraat', name: 'POS Ziraat', icon: '🏧' },
    { id: 'pos_is', name: 'POS Is', icon: '🏧' },
    { id: 'pos_yk', name: 'POS YapiKredi', icon: '🏧' },
  ],
};

function cloneSeed() {
  return JSON.parse(JSON.stringify(baseSeedDb));
}

export async function seedAuthenticatedApp(page: Page, mutate?: (db: any) => void) {
  const db = cloneSeed();
  if (mutate) mutate(db);

  await page.addInitScript((seedDb) => {
    window.localStorage.setItem('sobaYonetim_setupDone', '1');
    window.localStorage.setItem('sobaYonetim_setupApplied', '1');
    window.localStorage.setItem('sobaYonetim', JSON.stringify(seedDb));
    window.sessionStorage.setItem('sobaUser_session', JSON.stringify({
      userId: 'admin-1',
      username: 'admin',
      role: 'admin',
      ts: Date.now(),
    }));
  }, db);
}

export async function gotoApp(page: Page) {
  await page.goto('/');
  await expect(page).toHaveTitle(/Parspel/i);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MODULE_GROUP: Record<string, string> = {
  'Tedarikçi': 'Tedarik',
  'Boruted': 'Tedarik',
  'Cari': 'Finans',
  'Kasa': 'Finans',
  'Bütçe': 'Finans',
  'Banka': 'Finans',
  'Raporlar': 'Analiz',
  'Ayarlar': 'Sistem',
};

async function ensureGroupOpen(page: Page, moduleLabel: string) {
  const group = MODULE_GROUP[moduleLabel];
  if (!group) return;
  const toggle = page.getByRole('button', { name: new RegExp(`${escapeRegExp(group)}\\s+grubunu`, 'i') }).first();
  if (await toggle.count()) {
    const name = ((await toggle.textContent()) || '').toLowerCase();
    if (name.includes('genislet')) {
      await toggle.click();
    }
  }
}

export async function openModule(page: Page, label: string) {
  await ensureGroupOpen(page, label);

  const buttonByName = page.getByRole('button', { name: new RegExp(`(^|\\s)${escapeRegExp(label)}(\\s|$)`, 'i') }).first();
  if (await buttonByName.count()) {
    await buttonByName.click();
  } else {
    await page.getByText(label, { exact: false }).first().click();
  }

  await expect(page.getByRole('heading', { name: new RegExp(label, 'i') })).toBeVisible();
}

export async function readDb(page: Page) {
  return await page.evaluate(() => {
    const raw = window.localStorage.getItem('sobaYonetim');
    return raw ? JSON.parse(raw) : null;
  });
}
