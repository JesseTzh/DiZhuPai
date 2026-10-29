// 牌面编号允许重复；交互按手牌位置区分，存档仍保留选中的牌面编号。
const selections = new WeakMap();

export function selectedHandIndices(game) {
  const cached = selections.get(game);
  if (cached?.hand === game.hands[0] && cached.cards === game.selected) return cached.indices;
  const available = [...game.hands[0]],
    indices = [];
  for (const id of game.selected) {
    const index = available.indexOf(id);
    if (index < 0) continue;
    indices.push(index);
    available[index] = null;
  }
  selections.set(game, { hand: game.hands[0], cards: game.selected, indices });
  return indices;
}

export function selectHandIndices(game, indices, selected) {
  const current = new Set(selectedHandIndices(game));
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= game.hands[0].length) continue;
    if (selected) current.add(index);
    else current.delete(index);
  }
  const chosen = [...current];
  game.selected = chosen.map((index) => game.hands[0][index]);
  selections.set(game, { hand: game.hands[0], cards: game.selected, indices: chosen });
}

// 按出现次数扣除，不能用 includes/filter 同时删除全部同牌面手牌。
export function subtractCards(hand, cards) {
  const remaining = [...hand];
  for (const id of cards) {
    const index = remaining.indexOf(id);
    if (index < 0) return null;
    remaining.splice(index, 1);
  }
  return remaining;
}
