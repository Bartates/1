const { chromium } = require('playwright');

// Usage: node scripts/setUserPassword.js <username> <newPassword> [url]
const username = process.argv[2] || 'solhan';
const newPassword = process.argv[3] || 'xxxx';
const URL = process.argv[4] || process.env.URL || 'http://localhost:3000/';
const SALT = 'solhan_soba_2026';

function log(...args) { console.log('[setUserPassword]', ...args); }

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  log('Navigating to', URL);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    log('Warning: could not reach', URL, e.message);
  }

  // Compute SHA-256(password + SALT) inside the page to match app's hashing
  const hash = await page.evaluate(async ({ pwd, salt }) => {
    const enc = new TextEncoder();
    const data = enc.encode(pwd + salt);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  }, { pwd: newPassword, salt: SALT });

  log('Computed hash for user', username);

  // Read existing users from localStorage, update or create user entry
  const result = await page.evaluate(({ username, hash }) => {
    try {
      const key = 'soba_users_cache';
      const raw = localStorage.getItem(key);
      let users = [];
      if (raw) {
        users = JSON.parse(raw);
        if (!Array.isArray(users)) users = [];
      }

      let user = users.find(u => u.username === username);
      if (user) {
        user.passwordHash = hash;
        user.updatedAt = new Date().toISOString();
      } else {
        user = {
          id: 'u_' + Date.now() + '_' + Math.floor(Math.random()*1000),
          username,
          passwordHash: hash,
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
        users.push(user);
      }

      localStorage.setItem(key, JSON.stringify(users));
      return { ok: true, usersCount: users.length, updatedUser: user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, { username, hash });

  if (result && result.ok) {
    log('LocalStorage updated — users count:', result.usersCount);
    log('Updated user:', result.updatedUser.username);
    // Give the app a chance to pick up the change, then reload
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{});
    // Take a screenshot for verification
    const out = `setUserPassword-${username}.png`;
    try {
      await page.screenshot({ path: out, fullPage: true });
      log('Screenshot saved to', out);
    } catch (e) {
      log('Screenshot failed:', e.message);
    }
  } else {
    log('Failed to update localStorage:', result && result.error);
  }

  await browser.close();
}

run().catch(err => {
  console.error('[setUserPassword] Error:', err);
  process.exit(2);
});
