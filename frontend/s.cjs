const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]','mobiletest@example.com');
  await p.fill('input[type="password"]','TestPass123!');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(1500);
  await p.goto('http://localhost:5173/tournaments', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);
  const has = await p.evaluate(() =>
    !!Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Archived tournaments')));
  console.log('archived section shown:', has);
  const bad = [];
  await p.screenshot({ path: process.argv[2], fullPage: true });
  await b.close();
})();
