// 浏览器测试共享工具:固定种子、测试 URL、阶段等待与状态注入。
// 各脚本仍自行启动浏览器与录像(tests/video.mjs),这里只收敛跨脚本重复的样板。
// 固定随机种子 dizhupai-347:发牌、赖子/印章与商店补货完全可复现,其首轮货架固定为
// frog/hand/dragon(shop-browser 依赖此顺序);改动种子前先确认依赖它的断言仍成立。
export const TEST_SEED = 'dizhupai-347';

// 构造测试页面 URL;params 里的同名参数(如 seed)会覆盖默认值,供特殊场景换种子。
export const url = (params = {}) => {
  const target = new URL(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  target.searchParams.set('seed', TEST_SEED);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  return target.href;
};

// 等待进入指定阶段;若该阶段还带着动画锁(如过牌转账),先等 gameApp.state.locked 解开。
export const waitPhase = (page, phase) =>
  page.waitForFunction((target) => gameApp.state.game.phase === target, phase);

// 从存档槽新建一局并等首次发牌完成、玩家可操作(第一小局总是玩家先手)。
export async function newGame(page) {
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing' && !gameApp.state.locked);
}

// 把玩家手牌换成已知牌并按当前规则(含印章)重排,便于精确断言牌型。
export const setHand = (page, ids) =>
  page.evaluate(async (cards) => {
    const { sortHand } = await import('/game/rules.js');
    const game = gameApp.state.game;
    game.hands[0] = sortHand([...cards], { stamp: game.stamp });
    game.selected = [];
    gameApp.render();
  }, ids);

// 造一个来自电脑的桌面目标并把回合交还玩家;move 传 null 即自由出牌。
export const setTarget = (page, move, cards = []) =>
  page.evaluate(
    (setup) => {
      const state = gameApp.state,
        game = state.game;
      game.phase = 'playing';
      game.turn = 0;
      game.target = setup ? { player: 1, move: setup.move, cards: setup.cards } : null;
      game.last = setup ? { player: 1, type: 'play', move: setup.move, cards: setup.cards } : null;
      state.locked = false;
      gameApp.render();
    },
    move ? { move, cards } : null,
  );

// 注入一件道具;需要指定赖子/印章牌面时,再单独设置 game.wildCard / game.stamp。
export const injectItem = (page, id) =>
  page.evaluate((item) => {
    const game = gameApp.state.game;
    game.items = [item];
    gameApp.render();
  }, id);
