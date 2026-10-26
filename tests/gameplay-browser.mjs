// 玩法规则走查:通过公开 UI(gameApp.select/play/pass 与真实按钮)驱动具体牌型,
// 覆盖单元测试之外的 UI 接线——按钮禁用、选牌标签、压牌与王炸。
// 道具相关走查已拆到 items-browser(每件道具一节),这里只保留无道具的纯规则。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { FULL_HD, openRecording } from './video.mjs';
import { newGame, setHand, setTarget, url } from './harness.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'gameplay-browser', { viewport: FULL_HD });
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const selectionText = () => page.locator('#selection').textContent();
const targetMove = () => page.evaluate(() => gameApp.state.game.target?.move ?? null);
try {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  await newGame(page);
  // 电脑过牌时金币进入玩家钱袋：这单转账应播放赢钱音效，而不是通用敲桌声。
  await page.evaluate(() => {
    window.soundLog = [];
    const play = gameApp.audio.play;
    gameApp.audio.play = (index) => {
      window.soundLog.push(index);
      return play(index);
    };
    gameApp.state.game.hands[1] = [0];
  });
  await setHand(page, [53, 2]);
  await page.evaluate(() => gameApp.select(53));
  await page.locator('#play-cards').click();
  await page.waitForFunction(() => gameApp.state.game.coins[0] === 105 && !gameApp.state.locked);
  assert.ok(await page.evaluate(() => window.soundLog.includes(4)), '电脑过牌播放赢钱音效');
  // 自由出牌回合:没选牌时出牌/过牌都不可用。
  assert.equal(await page.evaluate(() => gameApp.state.game.target), null);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await page.locator('#pass-turn').isEnabled(), false);
  assert.equal(await selectionText(), '');
  // 顺子:三到七,五张不同花色;打出后桌面目标就是这手顺子。
  await setHand(page, [2, 16, 30, 44, 6, 12, 25]);
  for (const id of [2, 16, 30, 44, 6]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 5 张 · 顺子');
  await page.locator('#play-cards').click();
  assert.deepEqual(await targetMove(), { type: 'straight', main: 7, length: 5, name: '顺子' });
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
  assert.equal(await page.evaluate(() => gameApp.state.game.hands[0].length), 2);
  // 压牌:用更大的对子盖住电脑的对子。
  await setHand(page, [12, 25, 51, 2, 15]);
  await setTarget(page, { type: 'pair', main: 10, length: 2, name: '对子' }, [9, 22]);
  for (const id of [12, 25]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).main, 13);
  // 压不过:更小的对子让出牌按钮禁用,直接调用 play 也会被规则拒绝。
  await setHand(page, [2, 15, 12, 25]);
  await setTarget(page, { type: 'pair', main: 15, length: 2, name: '对子' }, [1, 14]);
  for (const id of [2, 15]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  const beforeReject = await page.evaluate(() => ({
    hand: [...gameApp.state.game.hands[0]],
    target: gameApp.state.game.target?.move,
    selected: [...gameApp.state.game.selected],
  }));
  await page.evaluate(() => gameApp.play());
  assert.deepEqual(
    await page.evaluate(() => ({
      hand: [...gameApp.state.game.hands[0]],
      target: gameApp.state.game.target?.move,
      selected: [...gameApp.state.game.selected],
    })),
    beforeReject,
    '压不过的出牌被整单拒绝',
  );
  // 炸弹与王炸:四张九压过单张 2,王炸再压过炸弹(留一张余牌,避免提前清空获胜)。
  await setHand(page, [8, 21, 34, 47, 52, 53, 51]);
  await setTarget(page, { type: 'single', main: 15, length: 1, name: '单张' }, [1]);
  for (const id of [8, 21, 34, 47]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 4 张 · 炸弹');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).type, 'bomb');
  await page.evaluate(() => {
    const state = gameApp.state;
    state.locked = false;
    state.game.turn = 0;
    state.game.target = {
      player: 1,
      move: { type: 'bomb', main: 14, length: 4, name: '炸弹' },
      cards: [0, 13, 26, 39],
    };
    gameApp.render();
  });
  for (const id of [52, 53]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 王炸');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).type, 'rocket');
  // 只剩一张牌时打出即获胜,胜场入账并进入商店。
  await setHand(page, [47]);
  await setTarget(page, null);
  await page.evaluate(() => gameApp.select(47));
  await page.locator('#play-cards').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'over');
  assert.equal(await page.evaluate(() => gameApp.state.game.winner), 0);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.wins), [1, 0]);
  assert.match(await page.evaluate(() => gameApp.state.game.message), /你赢了这一局/);
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'Gameplay browser flow passed: straights, pairs, rejected beats, bomb, rocket and win-to-shop.',
  );
} finally {
  await browser.close();
  await recording.save();
}
