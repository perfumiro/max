const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Ziko/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

// Render the real dialog templates without authentication or catalog writes.
const js = fs.readFileSync('assets/admin/admin.js', 'utf8');
const css = fs.readFileSync('assets/admin/admin.css', 'latin1');
const availability = js.slice(js.indexOf('const productAvailabilityFields ='), js.indexOf('const readProductAvailabilityFields ='));
function dialog(kind) {
  const start = js.indexOf(`modal.id = '${kind}ProductModal'`);
  const end = js.indexOf('document.body.appendChild(modal);', start);
  return `${availability}\nconst modal = document.createElement('div');\n${js.slice(start, end)}\nmodal.style.display = 'block'; document.body.appendChild(modal);`;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[320, 568], [393, 740], [430, 932], [740, 360], [1440, 1000]]) {
      for (const kind of ['add', 'edit']) {
        const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 800, hasTouch: true });
        await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><body data-theme="dark"></body>');
        await page.addStyleTag({ content: css });
        await page.evaluate(dialog(kind));
        const modal = page.locator(`#${kind}ProductModal`);
        // Expand optional fields too: all content must stay reachable.
        await modal.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
        await modal.evaluate(node => { node.scrollTop = node.scrollHeight; });
        const save = page.locator(`#save${kind === 'add' ? 'Add' : 'Edit'}ProductBtn`);
        if (kind === 'edit') await save.scrollIntoViewIfNeeded();
        const box = await save.boundingBox();
        assert(box && box.y >= 0 && box.y + box.height <= height, `${kind} save clipped at ${width}x${height}: ${JSON.stringify(box)}`);
        await save.click({ trial: true });
        assert.equal(await modal.evaluate(node => node.scrollWidth > node.clientWidth), false, 'Horizontal overflow');
        await modal.evaluate(node => { node.scrollTop = 0; });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: height * .8 }] });
        for (let step = 1; step <= 10; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 8, y: height * (.8 - step * .05) }] });
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(id => document.getElementById(id).scrollTop > 0, `${kind}ProductModal`, { timeout: 3000 });
        if (width === 393 && kind === 'add') {
          await modal.evaluate(node => { node.scrollTop = node.scrollHeight; });
          fs.mkdirSync('out', { recursive: true });
          await page.screenshot({ path: 'out/product-modal-scroll-fixed.png' });
        }
        console.log(`PASS ${kind}: ${width}x${height}, touch scrolling and Save reachable`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

