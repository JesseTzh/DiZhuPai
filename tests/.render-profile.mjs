// Render-cost profiler (not part of npm test): samples JS render time per frame
// on the performance page under each animation load. Usage: node tests/.render-profile.mjs [label]
import { chromium } from 'playwright';

const label = process.argv[2] || 'baseline';
const headless = process.env.HEADED !== '1';
const browser = await chromium.launch({ channel: 'chrome', headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = new URL('http://127.0.0.1:5173/performance.html');
url.searchParams.set('dpr', process.env.DPR || '2');
await page.goto(url.href);
await page.evaluate(() => performanceApp.ready());
assert((await page.locator('#fig').getAttribute('data-renderer')) === 'cpu');
await page.locator('#density').selectOption('4');
await page.waitForTimeout(1500);

const LOADS = ['deal', 'play', 'transfer', 'bags', 'physics', 'selection', 'all'];
const results = {};
const toggles = page.locator('[data-animation]');
for (const load of LOADS) {
  // Playwright check/uncheck fire real change events, so `enabled` stays in sync.
  for (const input of await toggles.all()) await (load === 'all' ? input.check() : input.uncheck());
  if (load !== 'all') await page.locator(`[data-animation="${load}"]`).check();
  await page.locator('#reset-metrics').click();
  await page.waitForTimeout(2500);
  results[load] = await page.evaluate(() => {
    const m = window.performanceApp.metrics;
    return { renderMs: m.renderMs, redraws: m.redrawsPerSecond, fps: m.fps };
  });
}
console.log(JSON.stringify({ label, dpr: process.env.DPR || '2', errors, results }, null, 2));
await browser.close();

function assert(ok, msg) {
  if (!ok) {
    console.error('ASSERT FAIL', msg);
    process.exit(1);
  }
}
