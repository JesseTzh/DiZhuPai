// 桌沿道具、长手牌避让与顶栏的桌面/触屏回归。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { newGame, url, checkTableViewport } from './harness.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
await mkdir('test-results', { recursive: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 858, height: 396 } : { width: 1920, height: 1080 },
      hasTouch: mobile,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url({ page: 'game' }));
    await page.evaluate(() => gameApp.ready());
    await newGame(page);
    await page.evaluate(async () => {
      const { ITEMS } = await import('/game/items.js');
      gameApp.state.game.items = ITEMS.map((item) => item.id);
      gameApp.render();
    });
    const resting = await page.locator('.card-deck[data-player="0"]').boundingBox();
    const samples = await page.evaluate(async () => {
      const game = gameApp.state.game;
      game.hands[0] = Array.from({ length: 32 }, (_, i) => i);
      game.hands[1] = Array.from({ length: 32 }, (_, i) => i);
      gameApp.render();
      const start = performance.now();
      const samples = [];
      while (performance.now() - start < 480) {
        await new Promise(requestAnimationFrame);
        samples.push(
          document.querySelector('.card-deck[data-player="0"]').getBoundingClientRect().y,
        );
      }
      return samples;
    });
    assert.ok(new Set(samples.map((value) => Math.round(value))).size > 3, '避让经过多个动画帧');
    const moved = await page.locator('.card-deck[data-player="0"]').boundingBox();
    assert.ok(resting.y - moved.y > 40, '长手牌使玩家牌堆向桌内避让');
    const rects = await page.evaluate(() => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        hand: [...document.querySelectorAll('.hand-card')].map(rect),
        props: [
          ...document.querySelectorAll(
            '.card-deck[data-player="0"], .money-bag[data-player="0"], .table-item',
          ),
        ].map(rect),
        icons: [...document.querySelectorAll('.topbar-item')].map(rect),
      };
    });
    await page.screenshot({
      path: `test-results/table-layout-${mobile ? 'mobile' : 'desktop'}-long.png`,
    });
    for (const prop of rects.props) {
      for (const card of rects.hand) {
        assert.ok(
          prop.right <= card.left ||
            prop.left >= card.right ||
            prop.bottom <= card.top ||
            prop.top >= card.bottom,
          `钱袋、牌堆、桌沿道具不遮挡长手牌 ${JSON.stringify({ prop, card, mobile })}`,
        );
      }
    }
    assert.ok(rects.icons[1].left - rects.icons[0].left <= 42, '顶栏图标紧凑排列');
    if (!mobile)
      assert.ok((await page.locator('#play-cards').boundingBox()).width < 160, '桌面行动按钮缩小');
    await checkTableViewport(page);
    await page.evaluate(() => {
      gameApp.state.game.hands = gameApp.state.game.hands.map((hand) => hand.slice(0, 18));
      gameApp.render();
    });
    await page.waitForTimeout(420);
    const returned = await page.locator('.card-deck[data-player="0"]').boundingBox();
    assert.ok(Math.abs(returned.y - resting.y) < 1, '手牌减少后牌堆平滑回位');
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `test-results/table-layout-${mobile ? 'mobile' : 'desktop'}.png`,
    });
    await page.close();
  }
  console.log('桌面和手机：长手牌避让、回位、桌沿道具、顶栏间距通过。');
} finally {
  await browser.close();
}
