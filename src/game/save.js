import {
  createGame,
  finishDeal,
  ruleOptions,
  STAGE_COUNT,
  ROUNDS_PER_STAGE,
  HAND_SIZE,
} from './state.js';
import { classify, beats } from './rules.js';
import { ITEMS } from './items.js';
import { TABLES } from './table.js';

export const SAVE_KEY = 'dizhupai-save';
export const SAVE_VERSION = 1;
export const MAX_SAVE_SIZE = 256 * 1024;
const palettes = ['mustard', 'tomato', 'mint', 'cobalt', 'blush'];
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const pair = (value, check) => Array.isArray(value) && value.length === 2 && value.every(check);
const cards = (value, max = 54) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((id) => integer(id, 0, 53)) &&
  new Set(value).size === value.length;
const same = (a, b) =>
  a === b ||
  (a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b) &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && same(a[key], b[key])));
const requireValid = (condition) => {
  if (!condition) throw new Error('存档内容不完整或已损坏');
};

// Only restore game data. Animation locks, timers and audio are recreated by the UI.
export function parseSave(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_SIZE) throw new Error('存档文件过大');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('无法读取存档，请选择有效的 JSON 文件');
  }
  requireValid(data && data.format === 'dizhupai');
  if (data.version !== SAVE_VERSION) throw new Error('不支持此存档版本');
  requireValid(typeof data.savedAt === 'string' && Number.isFinite(Date.parse(data.savedAt)));
  requireValid(TABLES.some((table) => table.id === data.tableStyle));
  requireValid(TABLES.some((table) => table.id === data.firstTable));
  requireValid(palettes.includes(data.palette));
  const g = data.game;
  requireValid(g && ['dealing', 'playing', 'over', 'shop'].includes(g.phase));
  requireValid(integer(g.round, 1, STAGE_COUNT * ROUNDS_PER_STAGE));
  requireValid(g.stage === Math.ceil(g.round / ROUNDS_PER_STAGE));
  requireValid(g.substage === ((g.round - 1) % ROUNDS_PER_STAGE) + 1);
  requireValid(
    pair(g.hands, (hand) => cards(hand, HAND_SIZE)) && pair(g.decks, (deck) => cards(deck)),
  );
  requireValid(pair(g.coins, (n) => integer(n, 0, 200)) && pair(g.wins, (n) => integer(n, 0, 9)));
  requireValid(
    Array.isArray(g.items) &&
      g.items.length <= ITEMS.length &&
      new Set(g.items).size === g.items.length,
  );
  requireValid(g.items.every((id) => ITEMS.some((item) => item.id === id)));
  requireValid(
    g.coins[0] + g.coins[1] ===
      200 - g.items.reduce((sum, id) => sum + ITEMS.find((item) => item.id === id).price, 0),
  );
  requireValid(g.wildCard === null || (g.items.includes('frog') && integer(g.wildCard, 0, 53)));
  requireValid(integer(g.turn, 0, 1) && (g.winner === null || integer(g.winner, 0, 1)));
  requireValid(
    typeof g.matchOver === 'boolean' && (g.matchWinner === null || integer(g.matchWinner, 0, 1)),
  );
  requireValid(g.matchOver === (g.matchWinner !== null));
  requireValid(cards(g.selected, HAND_SIZE) && g.selected.every((id) => g.hands[0].includes(id)));
  requireValid(Array.isArray(g.history) && g.history.length <= HAND_SIZE * 4);
  let target = null,
    last = null,
    turn = (g.round - 1) % 2;
  const played = [[], []];
  for (const entry of g.history) {
    requireValid(entry && entry.player === turn);
    if (entry.type === 'play') {
      requireValid(cards(entry.cards, HAND_SIZE) && entry.cards.length > 0);
      const move = classify(entry.cards, ruleOptions(g, turn), target?.move);
      requireValid(beats(move, target?.move));
      // Recompute names and rule metadata rather than trusting imported markup.
      requireValid(same(entry.move, move));
      last = { player: turn, type: 'play', move, cards: [...entry.cards] };
      target = { player: turn, move, cards: [...entry.cards] };
      played[turn].push(...entry.cards);
    } else {
      requireValid(
        entry.type === 'pass' && target && target.player !== turn && integer(entry.amount, 0, 5),
      );
      last = { type: 'pass', player: turn, amount: entry.amount };
      target = null;
    }
    turn = 1 - turn;
  }
  requireValid(same(g.last, last) && same(g.target, target));
  for (let p = 0; p < 2; p++) {
    requireValid(g.decks[p].length === (ROUNDS_PER_STAGE - g.substage) * HAND_SIZE);
    requireValid(g.hands[p].length + played[p].length === HAND_SIZE);
    requireValid(cards([...g.hands[p], ...played[p], ...g.decks[p]]));
  }
  requireValid(g.wildCard === null || [...g.hands[0], ...played[0]].includes(g.wildCard));
  const ended = g.phase === 'over' || g.phase === 'shop';
  requireValid(ended === (g.winner !== null));
  requireValid(g.wins[0] + g.wins[1] === g.round - (ended ? 0 : 1));
  if (ended) {
    requireValid(g.hands[g.winner].length === 0 || (g.matchOver && g.coins[1 - g.winner] === 0));
    requireValid(g.wins[g.winner] > 0 && last?.player !== undefined);
    requireValid(g.turn === (last.type === 'pass' ? 1 - last.player : last.player));
    if (g.matchOver) requireValid(g.phase === 'over');
    else requireValid(g.round < STAGE_COUNT * ROUNDS_PER_STAGE);
  } else {
    requireValid(!g.matchOver && g.hands.every((hand) => hand.length > 0) && g.turn === turn);
    if (g.phase === 'dealing') requireValid(g.history.length === 0);
  }
  const game = Object.fromEntries(Object.keys(createGame()).map((key) => [key, g[key]]));
  // Animation effects already have their final balances in the logical game state.
  finishDeal(game);
  if (game.phase === 'over' && !game.matchOver) game.phase = 'shop';
  game.message =
    game.phase === 'shop'
      ? '逛逛小店，为下一局添件玩具'
      : game.phase === 'over'
        ? game.matchWinner === 0
          ? '你赢得了整场'
          : '电脑赢得了整场'
        : game.turn === 0
          ? '轮到你出牌'
          : '电脑思考中';
  return { ...data, game };
}

export function serializeSave(game, { tableStyle, firstTable, palette }, now = new Date()) {
  return JSON.stringify(
    {
      format: 'dizhupai',
      version: SAVE_VERSION,
      savedAt: now.toISOString(),
      tableStyle,
      firstTable,
      palette,
      game: Object.fromEntries(Object.keys(createGame()).map((key) => [key, game[key]])),
    },
    null,
    2,
  );
}

export function loadSave(storage) {
  try {
    const text = storage.getItem(SAVE_KEY);
    return { save: text ? parseSave(text) : null, error: null };
  } catch (error) {
    return { save: null, error: `读取本地存档失败：${error.message}` };
  }
}

export const SLOT_KEYS = [SAVE_KEY];
const SINGLE_SAVE_MIGRATION_KEY = 'dizhupai-single-save-migrated';

export function loadSaveSlots(storage) {
  // Keep old slot data as backups; migrate the last active progress only once.
  try {
    if (storage.getItem(SAVE_KEY) || storage.getItem(SINGLE_SAVE_MIGRATION_KEY))
      return [loadSave(storage)];
    const oldKeys = [0, 1, 2].map((index) => `${SAVE_KEY}-slot-${index + 1}`);
    const active = storage.getItem('dizhupai-active-slot');
    const preferred = active !== null ? oldKeys[Number(active)] : null;
    let invalid = null;
    for (const key of new Set([preferred, ...oldKeys].filter(Boolean))) {
      const text = storage.getItem(key);
      if (!text) continue;
      try {
        parseSave(text);
      } catch (error) {
        invalid = error;
        continue;
      }
      storage.setItem(SAVE_KEY, text);
      storage.setItem(SINGLE_SAVE_MIGRATION_KEY, '1');
      return [loadSave(storage)];
    }
    if (invalid) throw invalid;
    storage.setItem(SINGLE_SAVE_MIGRATION_KEY, '1');
    return [loadSave(storage)];
  } catch (error) {
    return [{ save: null, error: `旧存档迁移失败：${error.message}` }];
  }
}
