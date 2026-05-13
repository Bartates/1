/**
 * screenshot-all.ts
 * Uygulamanın tüm görünümlerini otomatik olarak ekran görüntüsü alır.
 * Çalıştır: npx ts-node scripts/screenshot-all.ts
 * veya:     npx playwright test scripts/screenshot-all.spec.ts
 */

import { chromium, type Browser, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Ayarlar ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000";
const OUT_DIR = "screenshots";
const USERNAME = process.env.APP_USERNAME || "admin";
const PASSWORD = process.env.APP_PASSWORD || "admin";
const VIEWPORT = { width: 1440, height: 900 };
const WAIT_MS = 800; // Her ekran görüntüsünden önce bekleme süresi

// ── Tüm Tab'lar ────────────────────────────────────────────────────────────
const MAIN_TABS = [
  // Ana
  { id: "dashboard", label: "Özet", group: "Ana" },
  { id: "products", label: "Ürünler", group: "Ana" },
  { id: "sales", label: "Satış", group: "Ana" },
  { id: "fatura", label: "Fatura", group: "Ana" },
  // Tedarik
  { id: "suppliers", label: "Tedarikçi", group: "Tedarik" },
  { id: "pelet", label: "Pelet", group: "Tedarik" },
  { id: "boruTed", label: "Boru Tedarik", group: "Tedarik" },
  // Finans
  { id: "cari", label: "Cari", group: "Finans" },
  { id: "kasa", label: "Kasa", group: "Finans" },
  { id: "butce", label: "Bütçe", group: "Finans" },
  { id: "bank", label: "Banka", group: "Finans" },
  // Analiz
  { id: "reports", label: "Raporlar", group: "Analiz" },
  { id: "cizelge", label: "Çizelge", group: "Analiz" },
  { id: "stock", label: "Stok", group: "Analiz" },
  { id: "monitor", label: "İzleme", group: "Analiz" },
  { id: "kontrol", label: "Kontrol", group: "Analiz" },
  // Sistem
  { id: "entegrasyon", label: "Entegrasyon", group: "Sistem" },
  { id: "excelmerge", label: "Veri Birleştir", group: "Sistem" },
  { id: "notlar", label: "Not Defteri", group: "Sistem" },
  { id: "partners", label: "Ortaklar", group: "Sistem" },
  { id: "settings", label: "Ayarlar", group: "Sistem" },
  { id: "bughunter", label: "Bug Hunter", group: "Sistem" },
] as const;

// Reports içindeki alt sekmeler
const REPORTS_TABS = [
  { id: "ozet", label: "Genel Özet" },
  { id: "satis", label: "Satış" },
  { id: "urun", label: "Ürün" },
  { id: "cari", label: "Cari" },
  { id: "gider", label: "Gider" },
  { id: "kasa", label: "Kasa" },
  { id: "banka", label: "Banka" },
  { id: "butce", label: "Bütçe" },
];

// Settings içindeki alt sekmeler
const SETTINGS_TABS = [
  { id: "genel", label: "Genel" },
  { id: "arayuz", label: "Arayüz" },
  { id: "baglantilar", label: "Bağlantılar" },
  { id: "kullanicilar", label: "Kullanıcılar" },
  { id: "ses", label: "Ses" },
  { id: "veri", label: "Veri" },
];

// ExcelMerge içindeki alt sekmeler
const EXCEL_TABS = [
  { id: "upload", label: "Dosya Yükle" },
  { id: "preview", label: "Önizleme" },
  { id: "diff", label: "Fark" },
  { id: "search", label: "Arama" },
  { id: "merge", label: "Birleştir" },
  { id: "temizle", label: "Temizle" },
  { id: "ai", label: "AI" },
];

// ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────
function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-ğüşıöçĞÜŞİÖÇ]/g, "_").replace(/_+/g, "_");
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshot(page: Page, name: string) {
  await wait(WAIT_MS);
  const filePath = path.join(OUT_DIR, `${sanitize(name)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  ✓ ${filePath}`);
}

// Sidebar'da belirli bir tab'a tıkla
async function clickTab(page: Page, tabId: string, tabLabel: string) {
  // Önce sidebar'daki nav butonunu bul
  const btn = page.locator(`button`).filter({ hasText: tabLabel }).first();
  try {
    await btn.click({ timeout: 5000 });
  } catch {
    // Alternatif: aria-label ile dene
    const btn2 = page.locator(`[aria-label*="${tabLabel}"]`).first();
    await btn2.click({ timeout: 3000 });
  }
  await wait(500);
}

// Grup genişlet (kapalıysa aç)
async function expandGroup(page: Page, groupName: string) {
  const toggle = page
    .locator(`button[aria-expanded="false"]`)
    .filter({ hasText: groupName });
  const count = await toggle.count();
  if (count > 0) {
    await toggle.first().click();
    await wait(300);
  }
}

// ── Ana fonksiyon ──────────────────────────────────────────────────────────
async function main() {
  // Çıktı klasörünü oluştur
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log("\n🚀 Soba Yönetim — Ekran Görüntüsü Aracı");
  console.log("━".repeat(50));

  // ── 1. Login ekranı ──────────────────────────────────────────────────────
  console.log("\n📸 Login ekranı...");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await screenshot(page, "00_login_ekrani");

  // ── 2. Giriş yap ─────────────────────────────────────────────────────────
  console.log("\n🔐 Giriş yapılıyor...");

  // Kullanıcı adı
  const usernameInput = page.locator('input[placeholder="Kullanıcı adı"]');
  await usernameInput.fill(USERNAME);

  // Şifre
  const passwordInput = page.locator('input[placeholder="Şifre"]');
  await passwordInput.fill(PASSWORD);

  // Giriş butonu
  const loginBtn = page
    .locator("button")
    .filter({ hasText: /giriş|login/i })
    .first();
  await loginBtn.click();

  // Uygulama yüklenene kadar bekle
  await page
    .waitForSelector(".app-shell", { timeout: 15000 })
    .catch(async () => {
      // Setup wizard olabilir
      await page.waitForTimeout(3000);
    });

  await wait(1500);
  console.log("  ✓ Giriş başarılı");

  // ── 3. Dashboard (ilk görünüm) ───────────────────────────────────────────
  console.log("\n📸 Ana ekranlar...");
  await screenshot(page, "01_dashboard_ilk_yukleme");

  // ── 4. Tüm grupları genişlet ─────────────────────────────────────────────
  for (const group of ["Tedarik", "Analiz", "Sistem"]) {
    await expandGroup(page, group);
  }

  // ── 5. Her ana tab için screenshot ──────────────────────────────────────
  let counter = 2;

  for (const tab of MAIN_TABS) {
    console.log(`\n📸 [${tab.group}] ${tab.label}...`);

    // Grubu genişlet
    await expandGroup(page, tab.group);

    // Tab'a tıkla
    await clickTab(page, tab.id, tab.label);
    await wait(1000);

    const num = String(counter).padStart(2, "0");
    await screenshot(page, `${num}_${tab.group}_${tab.label}`);
    counter++;

    // ── Reports alt sekmeleri ──────────────────────────────────────────────
    if (tab.id === "reports") {
      console.log("  → Reports alt sekmeleri...");
      for (const rtab of REPORTS_TABS) {
        const rBtn = page
          .locator("button")
          .filter({ hasText: rtab.label })
          .first();
        try {
          await rBtn.click({ timeout: 3000 });
          await wait(800);
          const rNum = String(counter).padStart(2, "0");
          await screenshot(page, `${rNum}_Raporlar_${rtab.label}`);
          counter++;
        } catch {
          console.log(`    ⚠ ${rtab.label} sekmesi bulunamadı`);
        }
      }
    }

    // ── Settings alt sekmeleri ─────────────────────────────────────────────
    if (tab.id === "settings") {
      console.log("  → Settings alt sekmeleri...");
      for (const stab of SETTINGS_TABS) {
        const sBtn = page
          .locator("button")
          .filter({ hasText: stab.label })
          .first();
        try {
          await sBtn.click({ timeout: 3000 });
          await wait(800);
          const sNum = String(counter).padStart(2, "0");
          await screenshot(page, `${sNum}_Ayarlar_${stab.label}`);
          counter++;
        } catch {
          console.log(`    ⚠ ${stab.label} sekmesi bulunamadı`);
        }
      }
    }

    // ── ExcelMerge alt sekmeleri ───────────────────────────────────────────
    if (tab.id === "excelmerge") {
      console.log("  → ExcelMerge alt sekmeleri...");
      for (const etab of EXCEL_TABS) {
        const eBtn = page
          .locator("button")
          .filter({ hasText: etab.label })
          .first();
        try {
          await eBtn.click({ timeout: 3000 });
          await wait(800);
          const eNum = String(counter).padStart(2, "0");
          await screenshot(page, `${eNum}_ExcelMerge_${etab.label}`);
          counter++;
        } catch {
          console.log(`    ⚠ ${etab.label} sekmesi bulunamadı`);
        }
      }
    }
  }

  // ── 6. Mobil görünüm (375px) ─────────────────────────────────────────────
  console.log("\n📱 Mobil görünümler...");
  await page.setViewportSize({ width: 375, height: 812 });
  await wait(500);

  // Dashboard mobil
  await clickTab(page, "dashboard", "Özet");
  const mNum1 = String(counter).padStart(2, "0");
  await screenshot(page, `${mNum1}_MOBIL_dashboard`);
  counter++;

  // Sidebar açık mobil
  const menuBtn = page.locator(".app-header-menu-btn").first();
  try {
    await menuBtn.click({ timeout: 3000 });
    await wait(500);
    const mNum2 = String(counter).padStart(2, "0");
    await screenshot(page, `${mNum2}_MOBIL_sidebar_acik`);
    counter++;
    // Sidebar kapat
    const closeBtn = page.locator(".app-sidebar-close-btn").first();
    await closeBtn.click({ timeout: 2000 }).catch(() => {});
  } catch {
    console.log("  ⚠ Mobil sidebar butonu bulunamadı");
  }

  // Satış mobil
  await clickTab(page, "sales", "Satış");
  const mNum3 = String(counter).padStart(2, "0");
  await screenshot(page, `${mNum3}_MOBIL_satis`);
  counter++;

  // Kasa mobil
  await clickTab(page, "kasa", "Kasa");
  const mNum4 = String(counter).padStart(2, "0");
  await screenshot(page, `${mNum4}_MOBIL_kasa`);
  counter++;

  // ── 7. Tablet görünüm (768px) ────────────────────────────────────────────
  console.log("\n📟 Tablet görünümler...");
  await page.setViewportSize({ width: 768, height: 1024 });
  await wait(500);

  await clickTab(page, "dashboard", "Özet");
  const tNum1 = String(counter).padStart(2, "0");
  await screenshot(page, `${tNum1}_TABLET_dashboard`);
  counter++;

  await clickTab(page, "reports", "Raporlar");
  const tNum2 = String(counter).padStart(2, "0");
  await screenshot(page, `${tNum2}_TABLET_raporlar`);
  counter++;

  // ── 8. Geniş ekran (1920px) ──────────────────────────────────────────────
  console.log("\n🖥️  Geniş ekran görünümleri...");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await wait(500);

  await clickTab(page, "dashboard", "Özet");
  const wNum1 = String(counter).padStart(2, "0");
  await screenshot(page, `${wNum1}_GENIS_dashboard`);
  counter++;

  await clickTab(page, "reports", "Raporlar");
  const wNum2 = String(counter).padStart(2, "0");
  await screenshot(page, `${wNum2}_GENIS_raporlar`);
  counter++;

  // ── Özet ─────────────────────────────────────────────────────────────────
  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png"));
  console.log("\n" + "━".repeat(50));
  console.log(`✅ Tamamlandı! ${files.length} ekran görüntüsü alındı.`);
  console.log(`📁 Klasör: ${path.resolve(OUT_DIR)}`);
  console.log("━".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("❌ Hata:", err);
  process.exit(1);
});
