import { expect, test } from '@playwright/test';
import { gotoApp, openModule, seedAuthenticatedApp } from './helpers/app';

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);
});

test('urun ekleme akisi calisiyor', async ({ page }) => {
  await openModule(page, 'Ürünler');
  await page.getByRole('button', { name: '+ Yeni Ürün' }).click();
  await page.locator('input').first().fill('E2E Urun');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByText('E2E Urun')).toBeVisible();
});

test('urunlerde az stok filtresi aciliyor', async ({ page }) => {
  await openModule(page, 'Ürünler');
  await page.getByRole('button', { name: /⚠️ Az/i }).click();
  await expect(page.getByRole('button', { name: /⚠️ Az/i })).toBeVisible();
});

test('tedarikci ekleme akisi calisiyor', async ({ page }) => {
  await openModule(page, 'Tedarikçi');
  await page.getByRole('button', { name: '+ Yeni Tedarikçi' }).click();
  await page.locator('input').first().fill('E2E Tedarikci');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByText('E2E Tedarikci')).toBeVisible();
});

test('tedarikci siparis olusturma akisi calisiyor', async ({ page }) => {
  await openModule(page, 'Tedarikçi');
  await page.getByRole('button', { name: '+ Sipariş Ver' }).click();

  await page.locator('select').filter({ hasText: '-- Tedarikçi Seç --' }).first().selectOption({ label: 'Test Tedarikci' });
  await page.locator('select').filter({ hasText: '-- Ürün Seç --' }).first().selectOption({ label: 'Deneme Sobasi' });
  await page.getByRole('button', { name: '📦 Sipariş Ver' }).last().click();

  await expect(page.getByRole('table').getByText('Test Tedarikci')).toBeVisible();
  await expect(page.getByRole('table').getByText('Deneme Sobasi')).toBeVisible();
});
