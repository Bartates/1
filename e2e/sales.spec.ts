import { expect, test } from '@playwright/test';
import { gotoApp, openModule, readDb, seedAuthenticatedApp } from './helpers/app';

async function openNewSale(page: Parameters<typeof test>[0]['page']) {
  await openModule(page, 'Satış');
  await page.getByRole('button', { name: '+ Yeni Satış' }).click();
}

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);
});

test('satis kaydedince tabloya satir dusuyor', async ({ page }) => {
  await openNewSale(page);
  await page.locator('select').first().selectOption('urun-1');
  await page.getByRole('button', { name: '-- Müşteri Seç (zorunlu) --' }).click();
  await page.getByRole('button', { name: /Test Musterisi 05550000000/i }).click();
  await page.getByRole('button', { name: /Satışı Kaydet/i }).click();

  await expect(page.getByRole('table').getByText('Deneme Sobasi')).toBeVisible();
  await expect(page.getByRole('table').getByText('Test Musterisi')).toBeVisible();
  await expect(page.getByRole('table').getByText('✓ Tamamlandı')).toBeVisible();
});

test('musteri secmeden satis kaydi engelleniyor', async ({ page }) => {
  await openNewSale(page);
  await page.locator('select').first().selectOption('urun-1');
  await page.getByRole('button', { name: /Satışı Kaydet/i }).click();

  await expect(page.getByText(/Müşteri seçimi zorunludur/i)).toBeVisible();
});

test('satis sonrasi stok ve kasa kaydi olusuyor', async ({ page }) => {
  await openNewSale(page);
  await page.locator('select').first().selectOption('urun-1');
  await page.getByRole('button', { name: '-- Müşteri Seç (zorunlu) --' }).click();
  await page.getByRole('button', { name: /Test Musterisi 05550000000/i }).click();
  await page.getByRole('button', { name: /Satışı Kaydet/i }).click();

  const db = await readDb(page);
  const product = db.products.find((p: any) => p.id === 'urun-1');
  const salesCount = db.sales.length;
  const kasaCount = db.kasa.length;

  expect(product.stock).toBe(7);
  expect(salesCount).toBe(1);
  expect(kasaCount).toBe(1);
});

test('durum filtresinde tamamlandi secilebiliyor', async ({ page }) => {
  await openModule(page, 'Satış');
  await page.getByRole('button', { name: '✓ Tamamlandı' }).click();
  await expect(page.getByRole('button', { name: '✓ Tamamlandı' })).toBeVisible();
});
