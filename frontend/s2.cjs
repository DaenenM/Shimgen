const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const seen = [];
  p.on('response', async (r) => {
    if (r.url().includes('/api/v1/tournaments/')) {
      try { const j = await r.json(); seen.push({ url: r.url(), n: (j.results ?? j).length }); } catch {}
    }
  });
  await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]','mobiletest@example.com');
  await p.fill('input[type="password"]','TestPass123!');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(1500);
  await p.goto('http://localhost:5173/tournaments', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  console.log(JSON.stringify(seen, null, 2));
  const btn = await p.$('button[aria-expanded]');
  if (btn) console.log('label:', (await btn.textContent()).trim());
  await b.close();
})();
