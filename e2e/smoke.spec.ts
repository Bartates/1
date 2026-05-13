import { expect, test } from '@playwright/test';
import { gotoApp, openModule, seedAuthenticatedApp } from './helpers/app';

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);
});

test('anasayfada hizli erisim gorunuyor', async ({ page }) => {
  await expect(page.getByText('Hızlı Erişim')).toBeVisible();
});

test('favoriye raporlar eklenebiliyor', async ({ page }) => {
  await page.getByLabel('Analiz grubunu genislet').click();
  await page.getByLabel('Raporlar favorilere ekle').click();
  await expect(page.getByRole('region', { name: 'Hızlı erişim' }).getByLabel('Raporlar hızlı erişim')).toBeVisible();
});

test('satis modulu aciliyor', async ({ page }) => {
  await openModule(page, 'Satış');
});

test('urunler modulu aciliyor', async ({ page }) => {
  await openModule(page, 'Ürünler');
});

test('kasa modulu aciliyor', async ({ page }) => {
  await openModule(page, 'Kasa');
});

test('cari modulu aciliyor', async ({ page }) => {
  await openModule(page, 'Cari');
});

test('tedarikci modulu aciliyor', async ({ page }) => {
  await openModule(page, 'Tedarikçi');
});

test('raporlar modulu aciliyor', async ({ page }) => {
  await page.getByLabel('Analiz grubunu genislet').click();
  await openModule(page, 'Raporlar');
});
