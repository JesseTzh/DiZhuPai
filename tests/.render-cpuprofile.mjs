// CPU sampling profile of the render path (not part of npm test).
// Aggregates self-time by function under the full animation load.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = new URL('http://127.0.0.1:5173/performance.html');
url.searchParams.set('dpr', process.env.DPR || '2');
await page.goto(url.href);
await page.evaluate(() => performanceApp.ready());
await page.locator('#density').selectOption('4');
// LOAD=deal|play|… profiles one animation type; default is every type at once.
if (process.env.LOAD)
  for (const input of await page.locator('[data-animation]').all())
    if ((await input.getAttribute('data-animation')) !== process.env.LOAD) await input.uncheck();
await page.waitForTimeout(2000);

const client = await page.context().newCDPSession(page);
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 });
await client.send('Profiler.start');
await page.waitForTimeout(Number(process.env.SECONDS || 6000));
const { profile } = await client.send('Profiler.stop');

// aggregate self time per function
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const total = profile.samples.length;
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i],
    node = nodes.get(id);
  if (!node) continue;
  const cf = node.callFrame,
    key = `${cf.functionName || '(anonymous)'} @ ${(cf.url || '').split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + 1);
}
const rows = [...self.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([k, n]) => `${((n / total) * 100).toFixed(1)}%  ${k}`);
console.log(`errors: ${JSON.stringify(errors)}`);
console.log(rows.join('\n'));
await browser.close();
