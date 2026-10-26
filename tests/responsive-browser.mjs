// 响应式布局走查:手机横屏(19.5:9)、小窗口、常见笔记本与全高清四档视口下,
// 检查页面不横向溢出、控件可用、商店可购、道具提示被夹在视口内;
// 另用触屏页验证竖屏持机会提示横屏、转回横屏后提示消失。
// 刻意不录像:本脚本中途切换视口,会把录像画布弄出灰边(录制器不放大画面)。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { url } from './harness.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
// 从手机横屏视口开始,逐档放大;每档重新加载页面,状态互不粘连。
const page = await browser.newPage({ viewport: { width: 858, height: 396 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const sizes = [
  [858, 396, '手机横屏(19.5:9)'],
  [800, 600, '小窗口'],
  [1280, 720, '笔记本 16:9'],
  [1920, 1080, '全高清(录像视口)'],
];
await mkdir('test-results', { recursive: true });
const noHorizontalScroll = async () =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '页面不应出现横向滚动',
  );
const endRound = () =>
  page.evaluate(() => {
    const state = gameApp.state,
      game = state.game;
    game.phase = 'playing';
    game.turn = 0;
    game.hands[0] = [0];
    game.selected = [0];
    game.target = null;
    state.locked = false;
    gameApp.play();
  });
const results = [];
try {
  for (const [width, height, label] of sizes) {
    await page.setViewportSize({ width, height });
    // 首页:入口按钮可见且不横向溢出。
    await page.goto(url());
    await page.evaluate(() => gameApp.ready());
    assert.ok(await page.locator('#enter-game').isVisible(), `${label}:入口按钮`);
    await noHorizontalScroll();
    await page.screenshot({ path: `test-results/responsive-home-${width}x${height}.png` });
    // 离开首页会经 pagehide 落盘存档;清空后下一页才能拿到干净的"新建游戏"槽位。
    await page.evaluate(() => localStorage.clear());
    // 对局:顶栏、手牌与行动按钮都在,选牌可撤销。
    await page.goto(url({ page: 'game' }));
    await page.evaluate(() => gameApp.ready());
    await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
    await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
    assert.ok(await page.locator('.game-topbar').isVisible(), `${label}:顶栏`);
    assert.equal(await page.locator('.hand-card').count(), 18, `${label}:整手牌`);
    assert.ok(await page.locator('#play-cards').isVisible(), `${label}:出牌按钮`);
    await page.locator('.hand-card').nth(9).dispatchEvent('pointerdown', { button: 0 });
    assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 1);
    // 点左上角空白处撤销选牌:任何视口下都不与牌面、顶栏命中区重叠。
    await page.mouse.click(4, 4);
    assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
    await noHorizontalScroll();
    await page.screenshot({ path: `test-results/responsive-game-${width}x${height}.png` });
    // 商店:收下青蛙道具,下一局桌面上出现赖子模型。
    await endRound();
    await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
    assert.ok(await page.locator('#shop').isVisible(), `${label}:商店`);
    assert.ok(await page.locator('#leave-shop').isVisible(), `${label}:离开商店`);
    await page.locator('[data-buy="frog"]').click();
    await noHorizontalScroll();
    await page.screenshot({ path: `test-results/responsive-shop-${width}x${height}.png` });
    await page.locator('#leave-shop').click();
    await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
    await page.waitForSelector('.wild-card-model');
    assert.equal(await page.locator('.wild-card-model').count(), 1, `${label}:赖子模型`);
    assert.equal(await page.locator('.table-item').count(), 1, `${label}:桌面道具`);
    // 道具提示必须在任何视口下都完整落在视口内(table-controls 负责夹紧)。
    await page.locator('#table-item-frog').hover();
    assert.ok(await page.locator('#item-tooltip').isVisible(), `${label}:道具提示`);
    const tip = await page.locator('#item-tooltip').boundingBox();
    assert.ok(tip.x >= 0 && tip.y >= 0, `${label}:提示不被夹出左/上边缘`);
    assert.ok(
      tip.x + tip.width <= width && tip.y + tip.height <= height,
      `${label}:提示完整落在视口内`,
    );
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#item-tooltip').isVisible(), false);
    // 性能页只抽查两端视口。
    if (width === 858 || width === 1920) {
      await page.goto(new URL('performance.html', url()).href);
      await page.evaluate(() => performanceApp.ready());
      await page.waitForFunction(() => performanceApp.metrics.samples > 4);
      assert.equal(await page.locator('[data-animation]').count(), 6, `${label}:性能页动画`);
      await noHorizontalScroll();
      await page.screenshot({
        path: `test-results/responsive-performance-${width}x${height}.png`,
      });
    }
    results.push({ viewport: `${width}x${height}`, label, passed: true });
    console.log(`${label} ${width}x${height} 通过`);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  // 手机端判定走查:触屏设备竖屏持机出现横屏提示,转回横屏后消失。
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 845 },
    hasTouch: true,
  });
  touchPage.on('pageerror', (error) => errors.push(error.message));
  await touchPage.goto(url());
  await touchPage.evaluate(() => gameApp.ready());
  assert.ok(await touchPage.locator('#rotate-hint').isVisible(), '触屏竖屏:横屏提示');
  await touchPage.screenshot({ path: 'test-results/responsive-rotate-portrait.png' });
  await touchPage.setViewportSize({ width: 858, height: 396 });
  // matchMedia 的 change 事件在下一帧才派发,等监听器真正把提示隐藏再断言。
  await touchPage.waitForFunction(() => document.getElementById('rotate-hint')?.hidden);
  assert.equal(await touchPage.locator('#rotate-hint').isVisible(), false, '转回横屏:提示消失');
  // 首次进入(先竖屏后转横屏)木桌也应居中:在提示消失后再等取景稳定,按首页
  // 木桌锚点的左右留白比较,偏差超过 8px 说明首帧用了旋转前/过渡中的布局。
  await touchPage.waitForTimeout(400);
  const homeFrame = await touchPage.evaluate(async () => {
    const { P } = await import('/engine/camera.js');
    const { world } = await import('/game/table.js');
    const fig = document.getElementById('fig');
    const ctm = fig.getScreenCTM();
    const anchor = document.querySelector('.home-table').getBoundingClientRect();
    const corners = [
      [-365, -265],
      [365, -265],
      [365, 265],
      [-365, 265],
    ].map(([u, v]) => {
      const [x, y] = P(...world(u, v, -1));
      const point = new DOMPoint(x, y).matrixTransform(ctm);
      return [point.x, point.y];
    });
    const xs = corners.map(([x]) => x),
      ys = corners.map(([, y]) => y);
    return {
      anchor: [anchor.left, anchor.top, anchor.width, anchor.height],
      painted: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      viewport: [innerWidth, innerHeight],
    };
  });
  const [ax, ay, aw, ah] = homeFrame.anchor,
    [px, py, pr, pb] = homeFrame.painted,
    [vw, vh] = homeFrame.viewport;
  assert.ok(
    Math.abs(px - ax - (ax + aw - pr)) < 8,
    `旋转后木桌左右留白对称(左 ${(px - ax).toFixed(1)}px,右 ${(ax + aw - pr).toFixed(1)}px)`,
  );
  assert.ok(Math.abs(py - ay - (ah * 12) / 585) < 3, '旋转后木桌按设计贴住锚点顶部');
  assert.ok(px >= 0 && py >= 0 && pr <= vw && pb <= vh, '旋转后木桌完整落在屏幕内');
  await touchPage.screenshot({ path: 'test-results/responsive-rotate-landscape.png' });
  await touchPage.close();
  await writeFile(
    'test-results/responsive-report.json',
    JSON.stringify({ passed: true, results, errors }, null, 2),
  );
  console.log('Responsive layout passed across phone, small window, laptop and full HD.');
} finally {
  await browser.close();
}
