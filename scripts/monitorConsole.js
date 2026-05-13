import { chromium } from 'playwright';

async function run() {
  const url = process.env.URL || 'http://localhost:3000/';
  const duration = parseInt(process.env.DURATION || '20000', 10);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    const args = msg.args().map((a) => a.toString());
    console.log(`[BROWSER][console:${msg.type()}]`, ...args);
  });

  page.on('pageerror', (err) => {
    console.error('[BROWSER][pageerror]', err.message);
  });

  page.on('requestfailed', (req) => {
    console.warn('[BROWSER][requestfailed]', req.url(), req.failure()?.errorText);
  });

  console.log(`Opening ${url} and listening for console messages for ${duration}ms...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await new Promise((r) => setTimeout(r, duration));

  console.log('Finished monitoring; closing browser.');
  await browser.close();
}

run().catch((err) => {
  console.error('monitorConsole error:', err);
  process.exit(1);
});
