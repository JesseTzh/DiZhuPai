import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { cardDeck, cardFrontPrints, cardSvg } from '../src/assets/cards/index.js';
import { cardGroup } from '../src/cards/constants.js';

test('deck contains all 52 suit/rank combinations and two distinct jokers', () => {
  assert.equal(cardDeck.length, 54);
  assert.equal(new Set(cardDeck.map((c) => c.key)).size, 54);
  assert.equal(new Set(cardFrontPrints).size, 54);
  for (const suit of ['heart', 'spade', 'diamond', 'club']) {
    assert.deepEqual(
      cardDeck.filter((c) => c.suit === suit).map((c) => c.rank),
      ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
    );
  }
  assert.deepEqual(
    cardDeck.filter((c) => c.kind === 'joker').map((c) => c.variant),
    ['black', 'red'],
  );
  assert.deepEqual(
    [0, 1, 2].map((kind) => cardGroup(kind).length),
    [40, 12, 2],
  );
  assert.equal(new Set([0, 1, 2].flatMap(cardGroup)).size, 54);
});

test('each numeric face has the actual pip count, correct corner indices and suit paths', () => {
  for (const card of cardDeck.filter((c) => c.kind === 'pip')) {
    const print = cardFrontPrints[card.id];
    assert.equal(
      (print.match(/data-suit=/g) || []).length - 2,
      card.rank === 'A' ? 1 : Number(card.rank),
      card.key,
    );
    assert.equal((print.match(new RegExp(`>${card.rank}</text>`, 'g')) || []).length, 2, card.key);
    assert.ok([...print.matchAll(/data-suit="([^"]+)"/g)].every((match) => match[1] === card.suit));
    assert.ok(!/undefined|NaN|Infinity/.test(print), card.key);
  }
});

test('court clipping references remain local and unique when the whole deck is mounted', () => {
  const allPrints = cardFrontPrints.join('');
  const ids = [...allPrints.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, ref] of allPrints.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), ref);
  for (const card of cardDeck.filter((c) => c.kind === 'court')) {
    const print = cardFrontPrints[card.id];
    assert.ok(print.includes(`data-court="${card.rank}"`));
    assert.ok(print.includes('translate(63 88) rotate(180)'));
    const svg = cardSvg(print, card.name, `export-${card.key}`);
    assert.ok(svg.includes(`url(#export-${card.key}-${card.key}-half)`));
    assert.ok(!svg.includes(`url(#${card.key}-half)`));
  }
});

test('standalone assets include 54 faces, five backs and a complete offline catalogue', async () => {
  const root = new URL('../src/assets/cards/', import.meta.url);
  const files = await readdir(new URL('svg/', root));
  assert.equal(files.filter((name) => name.endsWith('.svg')).length, 59);
  const preview = await readFile(new URL('preview.html', root), 'utf8');
  for (const card of cardDeck) {
    const svg = await readFile(new URL(`svg/${card.key}.svg`, root), 'utf8');
    assert.ok(svg.includes('viewBox="0 0 63 88"'));
    assert.ok(svg.includes(`<title id="${card.key}-title">${card.name}</title>`));
    assert.ok(preview.includes(`svg/${card.key}.svg`));
  }
});
