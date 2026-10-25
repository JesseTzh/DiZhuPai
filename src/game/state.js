import { sortHand, classify, beats, rankOf } from './rules.js';
import { ITEMS, hasItemRule } from './items.js';
import { gameRandom } from './random.js';
export const PASS_COST = 5;
export const STAGE_COUNT = 3;
export const ROUNDS_PER_STAGE = 3;
export const HAND_SIZE = 18;
export const SHOP_SLOTS = 3;
export const createGame = (seed = null) => ({
  phase: 'ready',
  seed,
  items: [],
  shopStock: null,
  wildCard: null,
  stamp: null,
  freePassUsed: false,
  stealUsed: false,
  hands: [[], []],
  decks: [[], []],
  coins: [100, 100],
  wins: [0, 0],
  round: 0,
  stage: 1,
  substage: 1,
  turn: 0,
  target: null,
  last: null,
  selected: [],
  winner: null,
  matchWinner: null,
  matchOver: false,
  message: '地主牌',
  history: [],
});

function finishOnBankruptcy(game, player) {
  if (game.coins[player] !== 0) return false;
  const winner = 1 - player;
  game.phase = 'over';
  game.winner = winner;
  game.matchWinner = winner;
  game.matchOver = true;
  game.wins[winner]++;
  game.message = player === 0 ? '你的金币已用完' : '电脑的金币已用完';
  return true;
}
export function deal(game, random) {
  if (!['ready', 'over', 'shop'].includes(game.phase) || game.matchOver || game.matchWinner != null)
    return false;
  if (game.round >= STAGE_COUNT * ROUNDS_PER_STAGE) return false;
  random = random ?? gameRandom(game, 'deal');
  const newStage = game.round % ROUNDS_PER_STAGE === 0;
  for (let p = 0; p < 2; p++) {
    if (newStage) {
      const deck = Array.from({ length: 54 }, (_, i) => i);
      for (let i = 53; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      game.decks[p] = deck;
    }
    game.hands[p] = sortHand(game.decks[p].splice(0, HAND_SIZE));
  }
  game.wildCard = hasItemRule(game, 'wildCard')
    ? game.hands[0][Math.floor(random() * game.hands[0].length)]
    : null;
  // The stamp lifts one card below the queen a rank, then the hand re-sorts around it.
  game.stamp = null;
  if (hasItemRule(game, 'stampUp')) {
    const stampable = game.hands[0].filter((id) => id !== game.wildCard && rankOf(id) < 12);
    const pick = stampable[Math.floor(random() * stampable.length)];
    if (pick !== undefined) game.stamp = { card: pick, rank: rankOf(pick) + 1 };
  }
  game.hands[0] = sortHand(game.hands[0], { stamp: game.stamp });
  game.freePassUsed = false;
  game.stealUsed = false;
  game.round++;
  game.stage = Math.floor((game.round - 1) / ROUNDS_PER_STAGE) + 1;
  game.substage = ((game.round - 1) % ROUNDS_PER_STAGE) + 1;
  game.phase = 'dealing';
  game.turn = (game.round - 1) % 2;
  game.target = null;
  game.last = null;
  game.selected = [];
  game.winner = null;
  game.history = [];
  game.message = '正在发牌';
  return true;
}
export function finishDeal(game) {
  if (game.phase === 'dealing') {
    game.phase = 'playing';
    game.message = game.turn === 0 ? '轮到你出牌' : '电脑思考中';
  }
}
export function play(game, p, cards) {
  if (game.phase !== 'playing' || game.turn !== p) return { error: '请等待你的回合' };
  if (!cards.length) return { error: '请先选牌' };
  cards = [...cards];
  if (!cards.every((id) => game.hands[p].includes(id))) return { error: '只能打出自己的手牌' };
  const options = ruleOptions(game, p);
  const move = classify(cards, options, game.target?.move);
  if (!move) return { error: '这些牌不能组成有效牌型' };
  if (!beats(move, game.target?.move, options))
    return { error: `请用更大的${game.target.move.name}，或炸弹、王炸` };
  // The mouse can bring home a twin of a card already held; every played id
  // leaves the hand exactly once.
  for (const id of cards) game.hands[p].splice(game.hands[p].indexOf(id), 1);
  game.selected = [];
  game.target = { player: p, move, cards: [...cards] };
  game.last = { player: p, type: 'play', move, cards: [...cards] };
  game.history.push(game.last);
  if (!game.hands[p].length) {
    game.phase = 'over';
    game.winner = p;
    game.wins[p]++;
    game.message = p === 0 ? '你赢了这一局' : '电脑赢了这一局';
    if (game.round === STAGE_COUNT * ROUNDS_PER_STAGE) {
      game.matchOver = true;
      game.matchWinner = game.wins[0] > game.wins[1] ? 0 : 1;
      game.message =
        game.matchWinner === 0 ? '九小关完成，你赢得了整场' : '九小关完成，电脑赢得了整场';
    }
  } else {
    game.turn = 1 - p;
    game.message = game.turn === 0 ? '轮到你出牌' : '电脑思考中';
  }
  return { move };
}
export function pass(game, p) {
  if (game.phase !== 'playing' || game.turn !== p) return { error: '请等待你的回合' };
  if (!game.target || game.target.player === p) return { error: '新一轮必须出牌' };
  // The mask covers the first pass of every small round.
  const free = p === 0 && hasItemRule(game, 'freePass') && !game.freePassUsed;
  if (free) game.freePassUsed = true;
  const amount = free ? 0 : Math.min(PASS_COST, game.coins[p]);
  game.coins[p] -= amount;
  game.coins[1 - p] += amount;
  game.last = { type: 'pass', player: p, amount };
  game.history.push(game.last);
  game.target = null;
  game.selected = [];
  game.turn = 1 - p;
  if (!finishOnBankruptcy(game, p))
    game.message = free
      ? '口罩护住了钱袋，你免费过牌'
      : p === 0
        ? '你过牌，电脑自由出牌'
        : '电脑过牌，你自由出牌';
  return { amount };
}

// The mouse carries the opponent's tabled play back into the player's hand, once per small round.
export function steal(game, p = 0) {
  if (game.phase !== 'playing' || game.turn !== p) return { error: '请等待你的回合' };
  if (!hasItemRule(game, 'stealPlay')) return { error: '没有小老鼠道具' };
  if (game.stealUsed) return { error: '小老鼠本小局已经用过' };
  if (!game.target || game.target.player === p) return { error: '桌上没有对方的出牌' };
  const cards = [...game.target.cards];
  game.hands[p] = sortHand([...game.hands[p], ...cards], { stamp: game.stamp });
  game.stealUsed = true;
  game.target = null;
  game.selected = [];
  game.last = { type: 'steal', player: p, cards };
  game.history.push(game.last);
  game.message = p === 0 ? '小老鼠把牌拖回了你手边，请出牌' : '电脑收走了你的出牌';
  return { cards };
}

export function ruleOptions(game, player = 0) {
  if (player !== 0) return {};
  return {
    wildCard: game.wildCard,
    looseTriple: hasItemRule(game, 'looseTriple'),
    shortStraight: hasItemRule(game, 'shortStraight'),
    stamp: hasItemRule(game, 'stampUp') ? game.stamp : null,
    equalBeat: hasItemRule(game, 'equalBeat'),
  };
}

// Every visit restocks the counter with three random toys from the ones still missing.
export function pickShopStock(game, random) {
  random = random ?? gameRandom(game, 'shop');
  const pool = ITEMS.filter((item) => !game.items.includes(item.id)).map((item) => item.id);
  const stock = [];
  while (stock.length < SHOP_SLOTS && pool.length)
    stock.push(...pool.splice(Math.floor(random() * pool.length), 1));
  return stock;
}

export function enterShop(game, random) {
  if (game.phase !== 'over' || game.matchOver) return false;
  game.phase = 'shop';
  game.shopStock = pickShopStock(game, random);
  game.selected = [];
  game.message = '逛逛小店，为下一局添件道具';
  return true;
}
export function buyItem(game, id) {
  if (game.phase !== 'shop') return { error: '请在小关结束后进入商店' };
  if (game.shopStock && !game.shopStock.includes(id)) return { error: '货架上没有这件道具' };
  const item = ITEMS.find((item) => item.id === id);
  if (!item) return { error: '没有这件道具' };
  if (game.items.includes(id)) return { error: '已经拥有这件道具' };
  if (game.coins[0] < item.price) return { error: '金币不足' };
  game.coins[0] -= item.price;
  game.items.push(id);
  game.shopStock = game.shopStock?.filter((stocked) => stocked !== id) ?? null;
  finishOnBankruptcy(game, 0);
  return { item };
}
