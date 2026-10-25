// Visual regression comparison (not part of npm test): renders the same seeded scene on two
// builds and reports pixel differences. node tests/.render-visual-diff.mjs beforeURL afterURL
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';

const [beforeURL, afterURL] = process.argv.slice(2);
if (!beforeURL || !afterURL) {
  console.error('usage: node tests/.render-visual-diff.mjs <before-base> <after-base>');
  process.exit(1);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

async function shot(base, file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${base}: ${e.message}`));
  const url = new URL('index.html', base);
  url.searchParams.set('seed', 'dizhupai-347');
  await page.goto(url.href);
  await page.evaluate(() => gameApp.ready());
  await page.locator('#enter-game').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  await page.evaluate(() => gameApp.start());
  // Fixed settle time: the deal (~2.7s) and its sound tails finish well inside 8s.
  await page.waitForTimeout(8000);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  return file;
}

await mkdir('test-results', { recursive: true });
const [a, b] = await Promise.all([
  shot(beforeURL, 'test-results/visual-before.png'),
  shot(afterURL, 'test-results/visual-after.png'),
]);

const A = PNG.sync.read(await (await import('node:fs/promises')).readFile(a)),
  B = PNG.sync.read(await (await import('node:fs/promises')).readFile(b));
let identical = 0,
  near = 0,
  big = 0,
  worst = 0;
const width = Math.min(A.width, B.width),
  height = Math.min(A.height, B.height);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const i = (y * A.width + x) * 4,
      j = (y * B.width + x) * 4;
    const d =
      Math.abs(A.data[i] - B.data[j]) +
      Math.abs(A.data[i + 1] - B.data[j + 1]) +
      Math.abs(A.data[i + 2] - B.data[j + 2]);
    if (d === 0) identical++;
    else if (d <= 24) near++;
    else big++;
    worst = Math.max(worst, d);
  }
const total = width * height;
console.log(
  JSON.stringify(
    {
      errors,
      size: `${width}x${height}`,
      identical: +(identical / total).toFixed(5),
      nearSubpixel: +(near / total).toFixed(5),
      different: +(big / total).toFixed(5),
      worstChannelSum: worst,
    },
    null,
    2,
  ),
);
await browser.close();
