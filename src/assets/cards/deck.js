import { suits } from './suits.js';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rankNames = { A: 'ACE', J: 'JACK', Q: 'QUEEN', K: 'KING' };

// Stable asset keys are shared by the scene, SVG export and preview catalogue.
export const cardDeck = [
  ...suits.flatMap((suit) =>
    ranks.map((rank) => ({
      key: `${suit.id}-${rank.toLowerCase()}`,
      rank,
      suit: suit.id,
      color: suit.color,
      accent: suit.accent,
      kind: ['J', 'Q', 'K'].includes(rank) ? 'court' : 'pip',
      name: `${suit.name} ${rank}`,
      label: `${rankNames[rank] || rank} OF ${suit.english}`,
    })),
  ),
  {
    key: 'joker-black',
    rank: 'JOKER',
    kind: 'joker',
    variant: 'black',
    name: '小王',
    label: 'BLACK JOKER',
  },
  {
    key: 'joker-red',
    rank: 'JOKER',
    kind: 'joker',
    variant: 'red',
    name: '大王',
    label: 'RED JOKER',
  },
].map((card, id) => Object.freeze({ ...card, id }));
Object.freeze(cardDeck);
