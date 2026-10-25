import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const viewport = { width: 1920, height: 1080 };
const browser = await chromium.launch({ channel: 'chrome' });

const newPage = () =>
  browser.newContext({ viewport }).then((context) => context.newPage());

// 入场动画期间场景会被瞬态放大，等布局连续稳定后再截。
const settle = async (page, tries = 60) => {
  let good = 0;
  for (let i = 0; i < tries; i++) {
    const ok = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight &&
        getComputedStyle(document.querySelector('#fig')).transform === 'none',
    );
    good = ok ? good + 1 : 0;
    if (good >= 4) return;
    await page.waitForTimeout(250);
  }
  assert.fail('Layout never settled (page keeps scrolling or zooming)');
};

// home.png
{
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(() => gameApp.ready());
  assert.ok(await page.locator('#home-screen').isVisible());
  await page.waitForTimeout(2000);
  await settle(page);
  await page.screenshot({ path: 'docs/screenshots/home.png', fullPage: true });
  assert.deepEqual(errors, []);
  await page.context().close();
  console.log('home.png done');
}

// game.png
{
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?page=game`);
  await page.evaluate(() => gameApp.ready());
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.locator('.hand-card').count(), 18);
  await page.waitForTimeout(600);
  await settle(page);
  await page.screenshot({ path: 'docs/screenshots/game.png', fullPage: true });
  assert.deepEqual(errors, []);
  await page.context().close();
  console.log('game.png done');
}

// shop.png
{
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?page=game`);
  await page.evaluate(() => gameApp.ready());
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  await page.evaluate(() => {
    const s = gameApp.state,
      g = s.game;
    g.phase = 'playing';
    g.turn = 0;
    g.hands[0] = [0];
    g.selected = [0];
    g.target = null;
    s.locked = false;
    gameApp.play();
  });
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.toy-model').count(), 3);
  await page.locator('.shop-product[data-item="hand"]').hover();
  await page.waitForTimeout(800);
  await settle(page);
  await page.screenshot({ path: 'docs/screenshots/shop.png', fullPage: true });
  assert.deepEqual(errors, []);
  await page.context().close();
  console.log('shop.png done');
}

// performance.png
{
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}performance.html`);
  await page.evaluate(() => performanceApp.ready());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshots/performance.png', fullPage: true });
  assert.deepEqual(errors, []);
  await page.context().close();
  console.log('performance.png done');
}

await browser.close();
