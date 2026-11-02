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

// 同时检查栏位对齐、固定间隙、桌面边框和实际 Canvas 像素。
export async function checkTableViewport(page) {
  const assert = (await import('node:assert/strict')).default;
  const result = await page.evaluate(async () => {
    const camera = (await import('/engine/camera.js')).cameraView();
    const mobile = (await import('/ui/device-mode.js')).isMobileLandscape();
    const rect = document.querySelector('.zwrap').getBoundingClientRect();
    const bar = document.querySelector('.game-topbar').getBoundingClientRect();
    const figure = document.getElementById('fig');
    const { P } = await import('/engine/camera.js');
    const { tableSize } = await import('/game/scene-frame.js');
    const { tableGeometry } = await import('/game/table-geometry.js');
    const size = tableSize(figure.viewBox.baseVal, rect);
    const points = tableGeometry(gameApp.state.tableStyle, size).B.map((point) => {
      const [x, y] = P(...point);
      return new DOMPoint(x, y).matrixTransform(figure.getScreenCTM());
    });
    const tableEdges = [
      Math.min(...points.map((p) => p.x)) - rect.left,
      rect.right - Math.max(...points.map((p) => p.x)),
      Math.min(...points.map((p) => p.y)) - rect.top,
      rect.bottom - Math.max(...points.map((p) => p.y)),
    ];
    const canvas = document.getElementById('cpu-scene');
    const ctx = canvas.getContext('2d');
    const pixels = [0.02, 0.25, 0.5, 0.75, 0.98].flatMap((x) =>
      [0.06, 0.25, 0.5, 0.75, 0.94].map(
        (y) =>
          ctx.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1)
            .data[3],
      ),
    );
    const hands = [...document.querySelectorAll('.hand-card')].map((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom
      );
    });
    return {
      camera,
      gap: mobile ? rect.left - bar.right : rect.top - bar.bottom,
      expectedGap: Number.parseFloat(
        getComputedStyle(document.body).getPropertyValue('--game-gap'),
      ),
      alignment: mobile
        ? [rect.top - bar.top, rect.bottom - bar.bottom]
        : [rect.left - bar.left, rect.right - bar.right],
      tableEdges,
      pixels,
      hands,
    };
  });
  assert.deepEqual(result.camera, { pitch: 90, distance: 0 }, '统一垂直无透视视角');
  assert.equal(result.gap, result.expectedGap, '牌桌与顶栏或侧栏保持固定间隙');
  assert.ok(
    result.alignment.every((delta) => Math.abs(delta) < 1),
    '牌桌与顶栏或侧栏对齐',
  );
  assert.ok(
    result.tableEdges.every((gap) => Math.abs(gap - 4) < 1),
    '桌面四边保留留白且不裁切',
  );
  assert.ok(
    result.pixels.every((alpha) => alpha > 240),
    '桌面材质覆盖画布边缘及中心',
  );
  assert.ok(result.hands.every(Boolean), '手牌完整保留在牌桌内');
}
