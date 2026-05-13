const { chromium, devices } = require('playwright');

// Usage: node scripts/verifyLoginAndScreenshots.cjs <username> <password> [url]
const username = process.argv[2] || 'solhan';
const password = process.argv[3] || 'xxxx';
const URL = process.argv[4] || process.env.URL || 'http://localhost:3000/';

const viewports = [
  { name: 'desktop-1366x768', width: 1366, height: 768, isMobile: false },
  { name: 'laptop-1440x900', width: 1440, height: 900, isMobile: false },
  { name: 'mobile-375x812', device: devices['iPhone 12'], nameOnly: 'mobile-375x812' },
];

function log(...args) { console.log('[verifyLogin]', ...args); }

async function runViewport(browser, spec) {
  const context = spec.device ? await browser.newContext({ ...spec.device }) : await browser.newContext({ viewport: { width: spec.width, height: spec.height } });
  const page = await context.newPage();
  log('Opening', URL, 'for', spec.name || spec.nameOnly);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});

  // Wait for login form
  const userSelector = 'input[placeholder="Kullanıcı adı"]';
  const passSelector = 'input[placeholder^="Şifre"]';
  await page.waitForSelector(userSelector, { timeout: 5000 }).catch(()=>{});

  try {
    await page.fill(userSelector, username);
    await page.fill(passSelector, password);
    await page.click('.login-btn');
  } catch (e) {
    log('Form fill/click failed:', e.message);
  }

  // Wait for login to proceed: login form removed or timeout
  try {
    await page.waitForSelector(userSelector, { state: 'detached', timeout: 6000 });
    log('Login likely succeeded (login form detached)');
  } catch {
    log('Login form still present or timeout — proceeding to capture screenshot anyway');
  }

  const out = `verify-${spec.name || spec.nameOnly}.png`;
  await page.screenshot({ path: out, fullPage: true }).catch(err => log('Screenshot failed:', err.message));
  log('Saved screenshot', out);

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const spec of viewports) {
    try {
      await runViewport(browser, spec);
    } catch (err) {
      log('Error for', spec.name || spec.nameOnly, err.message);
    }
  }
  await browser.close();
}

main().catch(err => { console.error('[verifyLogin] Error:', err); process.exit(2); });
