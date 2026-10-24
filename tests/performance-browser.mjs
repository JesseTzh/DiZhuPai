import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Use a visible, foreground Chrome window for the actual display's refresh rate.
// Headless Chrome is usually capped at 60 Hz.
const headless = process.env.HEADED === '0';
const browser = await chromium.launch({ channel: 'chrome', headless });
const viewport = {
  width: Number(process.env.WIDTH || 1280),
  height: Number(process.env.HEIGHT || 720),
};
const page = await browser.newPage({ viewport });
const scales = (process.env.SCALES || '2,4').split(',');
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const duration = Math.max(16, Number(process.env.SECONDS || 24));
const errors = [],
  report = {
    headless,
    viewport,
    duration,
    targets: { cpu: 60 },
    runs: [],
  };
page.on('pageerror', (error) => errors.push(error.message));
async function measure(seconds) {
  return page.evaluate(async (seconds) => {
    const intervals = [],
      windows = [],
      renderSamples = [];
    let last = await new Promise(requestAnimationFrame),
      start = last,
      windowStart = last,
      frames = 0;
    while (last - start < seconds * 1000) {
      const now = await new Promise(requestAnimationFrame);
      intervals.push(now - last);
      frames++;
      last = now;
      if (now - windowStart >= 1000) {
        windows.push((frames * 1000) / (now - windowStart));
        renderSamples.push(performanceApp.metrics.renderMs);
        windowStart = now;
        frames = 0;
      }
    }
    const sorted = intervals.slice().sort((a, b) => a - b),
      p = (f) => sorted[Math.floor((sorted.length - 1) * f)];
    return {
      fps: (intervals.length * 1000) / (last - start),
      minWindowFps: Math.min(...windows),
      windows,
      p50Ms: p(0.5),
      p95Ms: p(0.95),
      p99Ms: p(0.99),
      maxMs: p(1),
      over60HzBudget: intervals.filter((ms) => ms > 1000 / 60 + 1).length,
      frames: intervals.length,
      renderMs: renderSamples,
    };
  }, seconds);
}
try {
  await mkdir('test-results', { recursive: true });
  for (const scale of scales) {
    const backend = 'cpu';
    const url = new URL('performance.html', base);
    url.searchParams.set('dpr', scale);
    await page.goto(url.href);
    await page.bringToFront();
    await page.evaluate(() => performanceApp.ready());
    assert.equal(await page.locator('#fig').getAttribute('data-renderer'), backend);
    const surface = await page.locator('#cpu-scene').evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
      cssWidth: canvas.getBoundingClientRect().width,
      cssHeight: canvas.getBoundingClientRect().height,
    }));
    assert.equal(surface.width, Math.round(surface.cssWidth * Number(scale)));
    assert.equal(surface.height, Math.round(surface.cssHeight * Number(scale)));
    await page.locator('#pause-all').click();
    const baseline = await measure(2);
    await page.locator('#pause-all').click();
    for (const density of ['1', '4']) {
      await page.locator('#density').selectOption(density);
      // Warm-up pipeline, images, caches and the selected load before sampling.
      await page.waitForTimeout(2000);
      const result = await measure(duration);
      report.runs.push({
        backend,
        scale: Number(scale),
        surface,
        density: Number(density),
        baselineFps: baseline.fps,
        ...result,
      });
      console.log(
        `${backend} DPR ${scale}× / load ${density}×: ${result.fps.toFixed(1)} FPS, slowest 1s ${result.minWindowFps.toFixed(1)}, P99 ${result.p99Ms.toFixed(1)} ms (display baseline ${baseline.fps.toFixed(1)})`,
      );
      await page.screenshot({
        path: `test-results/performance-${backend}-dpr${scale}-${density}x.png`,
      });
    }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  // Preserve all evidence even if a performance target fails.
  report.errors = errors;
  await writeFile('test-results/performance-report.json', JSON.stringify(report, null, 2));
  for (const run of report.runs) {
    if (run.backend === 'cpu') {
      assert.ok(run.baselineFps >= 59, 'The display must support 60 Hz');
      assert.ok(
        run.fps >= 59 && run.minWindowFps >= 57,
        `CPU 60 Hz target failed at DPR ${run.scale}× / load ${run.density}×`,
      );
    }
  }
} finally {
  await browser.close();
}
