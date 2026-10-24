import { sortHand, classify, beats } from './rules.js';
import { ITEMS } from './items.js';
export const PASS_COST = 5;
export const STAGE_COUNT = 3;
export const ROUNDS_PER_STAGE = 3;
export const HAND_SIZE = 18;
export const createGame = () => ({
  phase: 'ready',
  items: [],
  wildCard: null,
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
export function deal(game, random = Math.random) {
  if (!['ready', 'over', 'shop'].includes(game.phase) || game.matchOver || game.matchWinner != null)
    return false;
  if (game.round >= STAGE_COUNT * ROUNDS_PER_STAGE) return false;
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
  game.wildCard = game.items.includes('frog')
    ? game.hands[0][Math.floor(random() * game.hands[0].length)]
    : null;
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
  if (!cards.every((id) => game.hands[p].includes(id))) return { error: '只能打出自己的手牌' };
  const move = classify(cards, ruleOptions(game, p), game.target?.move);
  if (!move) return { error: '这些牌不能组成有效牌型' };
  if (!beats(move, game.target?.move))
    return { error: `请用更大的${game.target.move.name}，或炸弹、王炸` };
  game.hands[p] = game.hands[p].filter((id) => !cards.includes(id));
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
  const amount = Math.min(PASS_COST, game.coins[p]);
  game.coins[p] -= amount;
  game.coins[1 - p] += amount;
  game.last = { type: 'pass', player: p, amount };
  game.history.push(game.last);
  game.target = null;
  game.selected = [];
  game.turn = 1 - p;
  if (!finishOnBankruptcy(game, p))
    game.message = p === 0 ? '你过牌，电脑自由出牌' : '电脑过牌，你自由出牌';
  return { amount };
}

export function ruleOptions(game, player = 0) {
  if (player !== 0) return {};
  return {
    wildCard: game.wildCard,
    looseTriple: game.items.includes('hand'),
    shortStraight: game.items.includes('dragon'),
  };
}
export function enterShop(game) {
  if (game.phase !== 'over' || game.matchOver) return false;
  game.phase = 'shop';
  game.selected = [];
  game.message = '逛逛小店，为下一局添件玩具';
  return true;
}
export function buyItem(game, id) {
  if (game.phase !== 'shop') return { error: '请在小关结束后进入商店' };
  const item = ITEMS.find((item) => item.id === id);
  if (!item) return { error: '没有这件道具' };
  if (game.items.includes(id)) return { error: '已经拥有这件道具' };
  if (game.coins[0] < item.price) return { error: '金币不足' };
  game.coins[0] -= item.price;
  game.items.push(id);
  finishOnBankruptcy(game, 0);
  return { item };
}
