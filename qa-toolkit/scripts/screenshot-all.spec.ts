/**
 * screenshot-all.spec.ts
 * Uygulamanın tüm görünümlerini ekran görüntüsü alır.
 *
 * Çalıştır:
 *   npx playwright test scripts/screenshot-all.spec.ts --reporter=line
 *
 * Login bilgilerini env ile geçirebilirsin:
 *   APP_USERNAME=admin APP_PASSWORD=1234 npx playwright test scripts/screenshot-all.spec.ts
 */

import { test, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Ayarlar ────────────────────────────────────────────────────────────────
const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const USERNAME = process.env.APP_USERNAME || "test";
const PASSWORD = process.env.APP_PASSWORD || "1111";
const OUT_DIR = "screenshots";
const WAIT_MS = 700;

// ── Tüm Tab Tanımları ──────────────────────────────────────────────────────
const MAIN_TABS = [
  { id: "dashboard", label: "Özet", group: "Ana" },
  { id: "products", label: "Ürünler", group: "Ana" },
  { id: "sales", label: "Satış", group: "Ana" },
  { id: "fatura", label: "Fatura", group: "Ana" },
  { id: "suppliers", label: "Tedarikçi", group: "Tedarik" },
  { id: "pelet", label: "Pelet", group: "Tedarik" },
  { id: "boruTed", label: "Boru Tedarik", group: "Tedarik" },
  { id: "cari", label: "Cari", group: "Finans" },
  { id: "kasa", label: "Kasa", group: "Finans" },
  { id: "butce", label: "Bütçe", group: "Finans" },
  { id: "bank", label: "Banka", group: "Finans" },
  { id: "reports", label: "Raporlar", group: "Analiz" },
  { id: "cizelge", label: "Çizelge", group: "Analiz" },
  { id: "stock", label: "Stok", group: "Analiz" },
  { id: "monitor", label: "İzleme", group: "Analiz" },
  { id: "kontrol", label: "Kontrol", group: "Analiz" },
  { id: "entegrasyon", label: "Entegrasyon", group: "Sistem" },
  { id: "excelmerge", label: "Veri Birleştir", group: "Sistem" },
  { id: "notlar", label: "Not Defteri", group: "Sistem" },
  { id: "partners", label: "Ortaklar", group: "Sistem" },
  { id: "settings", label: "Ayarlar", group: "Sistem" },
  { id: "bughunter", label: "Bug Hunter", group: "Sistem" },
];

// Reports alt sekmeleri — Reports.tsx'ten alınan gerçek label'lar
const REPORTS_SUBTABS = ["Genel Özet", "Satış", "Ürün & Stok", "Cari", "Kasa"];

// Settings alt sekmeleri — Settings.tsx TABS_LIST'ten alınan gerçek label'lar
const SETTINGS_SUBTABS = [
  "Arayüz",
  "Bağlantılar",
  "Şirket",
  "Kategoriler",
  "Pelet",
  "Ses",
  "Agentlar",
  "Yedek & Geri Yükleme",
  "Excel Çıktı",
  "Aktivite",
  "Kısayollar",
  "Veri Onarım",
  "Excel İçe Aktar",
  "Veri Yönetimi",
  "Güvenlik",
  "Sistem Haritası",
  "Hakkında",
];

// ExcelMerge alt sekmeleri — ExcelMerge.tsx TABS'tan alınan gerçek label'lar
const EXCEL_SUBTABS = [
  "Dosya Yükle",
  "Önizleme",
  "Karşılaştır",
  "Gelişmiş Arama",
  "Birleştir",
  "ETL Temizle",
  "AI Asistan",
];

// ── Yardımcılar ────────────────────────────────────────────────────────────
function sanitize(str: string) {
  return str.replace(/[^\w\-]/g, "_").replace(/_+/g, "_");
}

let counter = 0;
async function snap(page: Page, name: string) {
  await page.waitForTimeout(WAIT_MS);
  counter++;
  const num = String(counter).padStart(3, "0");
  const file = path.join(OUT_DIR, `${num}_${sanitize(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✓ [${num}] ${name}`);
}

async function expandGroup(page: Page, groupName: string) {
  const btn = page
    .locator('button[aria-expanded="false"]')
    .filter({ hasText: groupName });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(300);
  }
}

async function clickNavTab(page: Page, label: string) {
  // Sidebar nav butonlarından bul (app-nav-tab-btn class'ı olan)
  const navBtn = page.locator(".app-nav-tab-btn").filter({ hasText: label });
  if ((await navBtn.count()) > 0) {
    // Mobilde sidebar viewport dışında olabilir — JS ile tıkla
    await navBtn.first().evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(600);
    return;
  }
  // Fallback: hızlı erişim grid'inden
  const quickBtn = page.locator(".app-priority-tab").filter({ hasText: label });
  if ((await quickBtn.count()) > 0) {
    await quickBtn.first().evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(600);
  }
}

async function clickSubTab(page: Page, label: string): Promise<boolean> {
  // Sayfa içindeki sekme butonlarını bul (sidebar dışında)
  const main = page.locator("main");
  const btn = main.locator("button").filter({ hasText: label }).first();
  if ((await btn.count()) > 0) {
    await btn.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

// ── Login ──────────────────────────────────────────────────────────────────
async function doLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // Firebase bağlantısı tamamlanana kadar bekle.
  // Form sadece fbStatus = 'ready' | 'first-setup' | 'error' olunca görünür.
  // "Kullanıcı adı" input'u görünene kadar bekle (max 30sn).
  const usernameInput = page.locator('input[placeholder="Kullanıcı adı"]');
  await usernameInput.waitFor({ state: "visible", timeout: 30000 });
  await usernameInput.fill(USERNAME);

  const passwordInput = page.locator('input[placeholder="Şifre"]').first();
  await passwordInput.fill(PASSWORD);

  // Giriş Yap butonu — class="login-btn"
  const loginBtn = page.locator("button.login-btn");
  await loginBtn.click();

  // App shell yüklenene kadar bekle
  await page.waitForSelector(".app-shell", { timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ── Test ───────────────────────────────────────────────────────────────────
test.describe.configure({ mode: "serial" });

test("Tüm görünümlerin ekran görüntüsünü al", async ({ page }) => {
  // Klasörü oluştur
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Viewport: masaüstü
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Login ekranı ─────────────────────────────────────────────────────────
  console.log("\n📸 Login ekranı");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await snap(page, "LOGIN_ekrani");

  // ── Giriş yap ────────────────────────────────────────────────────────────
  console.log("\n🔐 Giriş yapılıyor...");
  await doLogin(page);
  console.log("  ✓ Giriş başarılı\n");

  // ── İlk yükleme ──────────────────────────────────────────────────────────
  await snap(page, "DASHBOARD_ilk_yukleme");

  // Tüm grupları genişlet
  for (const g of ["Tedarik", "Analiz", "Sistem"]) {
    await expandGroup(page, g);
  }

  // ── Ana Tab'lar ───────────────────────────────────────────────────────────
  console.log("📸 Ana tab'lar...");
  for (const tab of MAIN_TABS) {
    await expandGroup(page, tab.group);
    await clickNavTab(page, tab.label);
    await snap(page, `${tab.group}_${tab.label}`);

    // ── Reports alt sekmeleri ───────────────────────────────────────────────
    if (tab.id === "reports") {
      console.log("  → Reports alt sekmeleri");
      for (const sub of REPORTS_SUBTABS) {
        const ok = await clickSubTab(page, sub);
        if (ok) await snap(page, `Raporlar_${sub}`);
        else console.log(`    ⚠ "${sub}" bulunamadı`);
      }
    }

    // ── Settings alt sekmeleri ──────────────────────────────────────────────
    if (tab.id === "settings") {
      console.log("  → Settings alt sekmeleri");
      for (const sub of SETTINGS_SUBTABS) {
        const ok = await clickSubTab(page, sub);
        if (ok) await snap(page, `Ayarlar_${sub}`);
        else console.log(`    ⚠ "${sub}" bulunamadı`);
      }
    }

    // ── ExcelMerge alt sekmeleri ────────────────────────────────────────────
    if (tab.id === "excelmerge") {
      console.log("  → ExcelMerge alt sekmeleri");
      for (const sub of EXCEL_SUBTABS) {
        const ok = await clickSubTab(page, sub);
        if (ok) await snap(page, `ExcelMerge_${sub}`);
        else console.log(`    ⚠ "${sub}" bulunamadı`);
      }
    }
  }

  // ── Mobil görünümler (375px) ──────────────────────────────────────────────
  console.log("\n📱 Mobil görünümler (375×812)...");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);

  await clickNavTab(page, "Özet");
  await snap(page, "MOBIL_dashboard");

  // Hamburger menü aç
  const menuBtn = page.locator(".app-header-menu-btn");
  if ((await menuBtn.count()) > 0) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    await snap(page, "MOBIL_sidebar_acik");
    // Kapat
    const closeBtn = page.locator(".app-sidebar-close-btn");
    if ((await closeBtn.count()) > 0) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  for (const tabLabel of ["Satış", "Ürünler", "Kasa", "Cari", "Raporlar"]) {
    await clickNavTab(page, tabLabel);
    await snap(page, `MOBIL_${tabLabel}`);
  }

  // ── Tablet görünümler (768px) ─────────────────────────────────────────────
  console.log("\n📟 Tablet görünümler (768×1024)...");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);

  for (const tabLabel of ["Özet", "Satış", "Raporlar", "Ayarlar"]) {
    await clickNavTab(page, tabLabel);
    await snap(page, `TABLET_${tabLabel}`);
  }

  // ── Geniş ekran (1920px) ──────────────────────────────────────────────────
  console.log("\n🖥️  Geniş ekran (1920×1080)...");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  for (const tabLabel of ["Özet", "Satış", "Raporlar", "Stok", "Ayarlar"]) {
    await clickNavTab(page, tabLabel);
    await snap(page, `GENIS_${tabLabel}`);
  }

  // ── Özet ──────────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  console.log(
    `\n✅ Tamamlandı! ${files.length} ekran görüntüsü → ${path.resolve(OUT_DIR)}\n`,
  );
});
