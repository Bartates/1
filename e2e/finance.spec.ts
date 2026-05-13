import { expect, test } from '@playwright/test';
import { gotoApp, openModule, seedAuthenticatedApp } from './helpers/app';

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedApp(page);
  await gotoApp(page);
});

test('cari ekleme akisi calisiyor', async ({ page }) => {
  await openModule(page, 'Cari');
  await page.getByRole('button', { name: '+ Yeni Cari' }).click();
  await page.locator('input').first().fill('Yeni Cari Test');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByRole('table').getByText('Yeni Cari Test')).toBeVisible();
});

test('cari duplicate ad kaydi engelleniyor', async ({ page }) => {
  await openModule(page, 'Cari');
  await page.getByRole('button', { name: '+ Yeni Cari' }).click();
  await page.locator('input').first().fill('Ayni Cari');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();
  await expect(page.getByRole('table').getByText('Ayni Cari')).toBeVisible();

  await page.getByRole('button', { name: '+ Yeni Cari' }).click();
  await page.locator('input').first().fill('Ayni Cari');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByText(/adında cari zaten var/i)).toBeVisible();
});

test('kasa gelir kaydi olusturuluyor', async ({ page }) => {
  await openModule(page, 'Kasa');
  await page.getByRole('button', { name: '+ Gelir' }).click();
  await page.locator('input[type="number"]').first().fill('1500');
  await page.getByPlaceholder('Açıklama...').fill('E2E Gelir Kaydi');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByRole('table').getByText('E2E Gelir Kaydi')).toBeVisible();
});

test('kasa gider kaydi olusturuluyor', async ({ page }) => {
  await openModule(page, 'Kasa');
  await page.getByRole('button', { name: '- Gider' }).click();
  await page.locator('input[type="number"]').first().fill('200');
  await page.getByPlaceholder('Açıklama...').fill('E2E Gider Kaydi');
  await page.getByRole('button', { name: '💾 Kaydet' }).click();

  await expect(page.getByRole('table').getByText('E2E Gider Kaydi')).toBeVisible();
});
