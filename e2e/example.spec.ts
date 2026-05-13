import { test, expect } from '@playwright/test';
import { gotoApp, openModule, seedAuthenticatedApp } from './helpers/app';

test('anasayfa yükleniyor', async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);
  await expect(page.getByText('Hızlı Erişim')).toBeVisible();
});

test('favori modül pinlenebiliyor', async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);

  await page.getByLabel('Analiz grubunu genislet').click();
  await page.getByLabel('Raporlar favorilere ekle').click();

  await expect(page.getByRole('region', { name: 'Hızlı erişim' }).getByLabel('Raporlar hızlı erişim')).toBeVisible();
});

test('satış akışı yeni kayıt oluşturuyor', async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);

  await openModule(page, 'Satış');
  await page.getByRole('button', { name: '+ Yeni Satış' }).click();

  await page.locator('select').first().selectOption('urun-1');
  await page.getByRole('button', { name: '-- Müşteri Seç (zorunlu) --' }).click();
  await page.getByRole('button', { name: /Test Musterisi 05550000000/i }).click();
  await page.getByRole('button', { name: /Satışı Kaydet/i }).click();

  await expect(page.getByRole('table').getByText('Deneme Sobasi')).toBeVisible();
  await expect(page.getByRole('table').getByText('Test Musterisi')).toBeVisible();
  await expect(page.getByRole('table').getByText('✓ Tamamlandı')).toBeVisible();
});
