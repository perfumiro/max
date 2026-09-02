const { chromium } = require('C:/Users/Ziko/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const widths = [320, 360, 375, 390, 393, 412, 430];
const pages = ['overview', 'orders', 'preorders', 'products', 'customers', 'settings'];

const orderCard = `<article class="mobile-work-card"><div class="mobile-work-head"><div class="mobile-work-title">Sara El Mansouri</div><span style="color:#f59e0b;background:#f59e0b18;padding:4px 8px;border-radius:99px;font-size:10px;font-weight:700">Pending</span></div><div class="mobile-work-meta"><strong>IP-2026-1042</strong> · Valentino Donna Born in Roma Eau de Parfum<br>06 12 34 56 78</div><div class="mobile-work-actions"><button class="btn btn-xs"><i class="fas fa-eye"></i> Details</button><a class="btn btn-xs" href="#" style="background:#25d366;color:#fff"><i class="fab fa-whatsapp"></i> WhatsApp</a><a class="btn btn-xs" href="#"><i class="fas fa-phone"></i> Call</a><button class="btn btn-xs btn-gold"><i class="fas fa-check"></i> Confirm</button></div></article>`;
const preorderCard = orderCard.replace('Pending', 'New request').replace('Confirm', 'Mark Contacted');
const customerCard = `<article class="mobile-work-card"><div class="mobile-work-title">Sara El Mansouri</div><div class="mobile-work-meta">Casablanca<br>06 12 34 56 78<br>3 orders</div><div class="mobile-work-actions"><a class="btn btn-xs" href="#" style="background:#25d366;color:#fff"><i class="fab fa-whatsapp"></i> WhatsApp</a><a class="btn btn-xs" href="#"><i class="fas fa-phone"></i> Call</a></div></article>`;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8000/admin.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ orderCard, preorderCard, customerCard }) => {
      document.querySelector('#authScreen')?.classList.add('hidden');
      document.querySelector('#dashboardScreen')?.classList.remove('hidden');
      const orders = document.querySelector('#ordersMobile'); if (orders) orders.innerHTML = orderCard;
      const preorders = document.querySelector('#preordersMobile'); if (preorders) preorders.innerHTML = preorderCard;
      const customers = document.querySelector('#customersMobile'); if (customers) customers.innerHTML = customerCard;
    }, { orderCard, preorderCard, customerCard });
    for (const view of pages) {
      await page.evaluate(name => {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.querySelector(`#view-${name}`)?.classList.add('active');
      }, view);
      await page.waitForTimeout(50);
      const metrics = await page.evaluate(() => {
        const badTargets = [...document.querySelectorAll('.view.active button, .view.active a, .view.active input, .view.active select')]
          .filter(el => {
            const r = el.getBoundingClientRect();
            if (el.matches('input[type="checkbox"], input[type="radio"]')) {
              const label = el.closest('label')?.getBoundingClientRect();
              return r.width > 0 && (!label || label.width < 40 || label.height < 40);
            }
            return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40);
          })
          .map(el => ({ tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
        return { overflow: document.documentElement.scrollWidth - innerWidth, badTargets };
      });
      results.push({ width, view, ...metrics });
    }
    await page.screenshot({ path: `out/mobile-admin-${width}.png`, fullPage: true });
    results.push({ width, pageErrors: errors.filter(error => !error.includes('Firebase')) });
    await page.close();
  }
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto('http://127.0.0.1:8000/admin.html', { waitUntil: 'domcontentloaded' });
  await desktop.evaluate(() => { document.querySelector('#authScreen')?.classList.add('hidden'); document.querySelector('#dashboardScreen')?.classList.remove('hidden'); });
  for (const view of pages) {
    await desktop.evaluate(name => { document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); document.querySelector(`#view-${name}`)?.classList.add('active'); }, view);
    const overflow = await desktop.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    results.push({ width: 1440, view, overflow, badTargets: [] });
  }
  await desktop.screenshot({ path: 'out/admin-desktop-regression.png', fullPage: true });
  await desktop.close();
  await browser.close();
  const failures = results.filter(r => r.overflow > 0 || r.badTargets?.length || r.pageErrors?.length);
  console.log(JSON.stringify({ tested: results.length, failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
})().catch(error => { console.error(error); process.exit(1); });
