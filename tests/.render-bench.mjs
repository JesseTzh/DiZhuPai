// Full-frame render benchmark (not part of npm test). .render-profile.mjs times only the JS
// that issues draw calls; here every animation-frame callback is followed by a forced flush
// of the scene canvas (a 1×1 read-back through a proxy), so GPU clip, blur and blit work count.
// The page runs its real animations, so cached and moving parts behave as in play.
// Usage: node tests/.render-bench.mjs [base-url ...]   (default http://127.0.0.1:5173/)
import { chromium } from 'playwright';

const bases = process.argv.slice(2);
if (!bases.length) bases.push('http://127.0.0.1:5173/');
const SECONDS = Number(process.env.SECONDS || 2.5);
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HEADED !== '1' });

// Time each rAF callback that clears the scene canvas (one scene draw), plus its flush.
const hook = () => {
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  let drew = 0;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (this.canvas.id === 'cpu-scene') drew++;
    return clear.apply(this, args);
  };
  const raf = window.requestAnimationFrame.bind(window);
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const read = probe.getContext('2d', { willReadFrequently: true });
  window.__frames = [];
  window.requestAnimationFrame = (callback) =>
    raf((time) => {
      const began = performance.now();
      drew = 0;
      callback(time);
      if (!drew) return;
      const scene = document.getElementById('cpu-scene');
      read.drawImage(scene, 0, 0, 1, 1);
      read.getImageData(0, 0, 1, 1);
      window.__frames.push(performance.now() - began);
      window.__draws = (window.__draws || 0) + drew;
    });
};
const collect = async (page) => {
  await page.evaluate(() => (window.__frames.length = 0));
  await page.waitForTimeout(SECONDS * 1000);
  return page.evaluate(() => {
    const t = window.__frames.slice().sort((a, b) => a - b);
    if (!t.length) return null;
    const mean = t.reduce((a, b) => a + b, 0) / t.length;
    return { n: t.length, mean: +mean.toFixed(2), p90: +t[Math.floor(t.length * 0.9)].toFixed(2) };
  });
};

for (const base of bases) {
  const results = {};
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(hook);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const perf = new URL('performance.html', base);
  perf.searchParams.set('dpr', process.env.DPR || '2');
  await page.goto(perf.href);
  await page.evaluate(() => performanceApp.ready());
  await page.locator('#density').selectOption('4');
  const toggles = await page.locator('[data-animation]').all();
  for (const load of ['deal', 'play', 'transfer', 'bags', 'physics', 'selection', 'all']) {
    for (const input of toggles) await (load === 'all' ? input.check() : input.uncheck());
    if (load !== 'all') await page.locator(`[data-animation="${load}"]`).check();
    await page.waitForTimeout(300);
    results[load] = await collect(page);
  }
  // Pointer sweeping across the resting hand: only one card moves per frame.
  const game = new URL('index.html', base);
  game.searchParams.set('seed', 'dizhupai-347');
  game.searchParams.set('dpr', process.env.DPR || '2');
  await page.goto(game.href);
  await page.evaluate(() => gameApp.ready());
  await page.locator('#enter-game').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  await page.evaluate(() => gameApp.start());
  await page.waitForTimeout(6000);
  const hand = await page.locator('[data-card]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    }),
  );
  await page.evaluate(() => (window.__frames.length = 0));
  for (let pass = 0; pass < 3; pass++)
    for (const [x, y] of pass % 2 ? hand.slice().reverse() : hand) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(45);
    }
  results.hover = await page.evaluate(() => {
    const t = window.__frames.slice().sort((a, b) => a - b);
    const mean = t.reduce((a, b) => a + b, 0) / t.length;
    return { n: t.length, mean: +mean.toFixed(2), p90: +t[Math.floor(t.length * 0.9)].toFixed(2) };
  });
  console.log(JSON.stringify({ base, errors }));
  for (const [k, v] of Object.entries(results)) console.log(k.padEnd(10), JSON.stringify(v));
  await context.close();
}
await browser.close();
