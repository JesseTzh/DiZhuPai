import { orb, rod, block, slab, planeText, path, ink } from '../engine/stage3d.js';
import { INK } from '../engine/palette.js';

/* 鹅掌柜杂货铺: an old shopfront seen level with its counter, like a pawnshop in a TV drama.
 * Room: floor, back wall with shelves of goods and a curtained doorway, two red pillars with couplets,
 *       a lintel beam carrying the shop sign, two lanterns.
 * Counter: plinth, lacquered body with framed panels and brass coins, wood top, a pawnshop grille at the left,
 *          an abacus propped on account books, ink stone, brush pot, bell and a string of coins at the right.
 * Behind it the goose shopkeeper; on it the three toys, each on its own little stand with a price card. */
export const C = {
  floor: ['#e3c393', '#c9a571', '#8f6c45'],
  wall: ['#f3e6c6', '#e4d2aa', '#b9a079'],
  timber: ['#9a6a45', '#7c5133', '#4f321f'],
  lacquer: ['#c8654a', '#a54c35', '#6a2c1f'],
  panel: ['#b25a40', '#8f4430', '#5c271b'],
  top: ['#e5b679', '#c99558', '#8e6236'],
  pillar: ['#e86a4e', '#c64f37', '#7f2c1e'],
  stone: ['#d9d4c7', '#bdb6a6', '#8c8577'],
  brass: ['#ffd56e', '#e2ab3d', '#a8752a'],
  sign: ['#4a3f38', '#332b26', '#1f1a17'],
  curtain: ['#7aa4dd', '#5a82c6', '#33507f'],
  shelf: ['#b88456', '#9a6a40', '#5f3f24'],
  bead: ['#a65b3a', '#7f4128', '#4c2416'],
  book: ['#5f8c78', '#467060', '#2a463c'],
  bookB: ['#e2c58a', '#c9a866', '#8c7240'],
  ink: ['#4a4540', '#2f2b27', '#1c1a17'],
  red: ['#f47b62', '#d6513c', '#8f2c20'],
  mint: ['#a9dcc0', '#7fbf9c', '#3f6e56'],
  mustard: ['#f8c64a', '#d49c1f', '#8a6414'],
  cobalt: ['#8eb2ea', '#5a82c6', '#2b4170'],
  blush: ['#f6b6c7', '#d8869c', '#8c4659'],
  white: ['#fffdf2', '#ebe3d1', '#b9ae98'],
  pot: ['#a3c4c9', '#7ea2a8', '#4b6b70'],
};
export const COUNTER_TOP = 94;

/* ---------- static room ---------- */
export function room(cam) {
  const parts = [];
  parts.push(Object.assign(block(-202, -52, -10, 202, 166, 0, C.floor), { ink: 2.8 }));
  parts.push(
    Object.assign(block(-188, 152, 0, 188, 162, 268, C.wall), {
      after: () => wallDetail(cam),
    }),
  );
  // doorway with a half-height cloth curtain behind the goose
  parts.push(block(-40, 149, 0, -34, 152, 205, C.timber));
  parts.push(block(34, 149, 0, 40, 152, 205, C.timber));
  parts.push(block(-40, 149, 199, 40, 152, 207, C.timber));
  parts.push(
    Object.assign(block(-34, 150.5, 120, 34, 151.5, 199, C.curtain), {
      flat: C.curtain[1],
      after: () => curtain(cam),
    }),
  );
  // shelves with goods, both sides of the door
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -176 : 52,
      x1 = side < 0 ? -52 : 176;
    for (const [i, z] of [118, 164, 210].entries()) {
      parts.push(block(x0, 128, z - 5, x1, 152, z, C.shelf));
      parts.push(...goods(x0, x1, z, side * 7 + i));
    }
    parts.push(block(x0 + 2, 146, 100, x0 + 6, 152, 214, C.shelf));
    parts.push(block(x1 - 6, 146, 100, x1 - 2, 152, 214, C.shelf));
  }
  return parts;
}
function wallDetail(cam) {
  // plaster joints and a timber band
  let s = '';
  for (const z of [232, 240])
    s += ink(
      path([cam.project([-188, 151.8, z]), cam.project([188, 151.8, z])], false),
      z === 232 ? 1.2 : 0.8,
    );
  for (const x of [-120, -60, 60, 120])
    s += ink(path([cam.project([x, 151.8, 240]), cam.project([x, 151.8, 268])], false), 0.7);
  return s;
}
function curtain(cam) {
  let s = '';
  for (const x of [-11, 11])
    s += ink(path([cam.project([x, 150.3, 199]), cam.project([x, 150.3, 120])], false), 1.1);
  for (const x of [-22, 0, 22]) {
    const c = cam.project([x, 150.3, 186]);
    s += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(3.4 * cam.k).toFixed(1)}" fill="none" stroke="#fff4d6" stroke-width="1.6"/>`;
  }
  return s;
}
// a deterministic mix of jars, boxes, scroll rolls and little toys on one shelf
function goods(x0, x1, z, seed) {
  const out = [];
  const pick = (i) =>
    [C.red, C.mint, C.mustard, C.cobalt, C.blush, C.white][(seed * 7 + i * 5 + 60) % 6];
  let x = x0 + 9,
    i = 0;
  while (x < x1 - 14) {
    const kind = (seed * 3 + i * 7 + 30) % 4,
      m = pick(i);
    if (kind === 0) {
      out.push(rod([x + 6, 140, z], [x + 6, 140, z + 15], 6, 6, m));
      out.push(rod([x + 6, 140, z + 15], [x + 6, 140, z + 19], 4, 3, C.timber));
      x += 17;
    } else if (kind === 1) {
      out.push(block(x, 133, z, x + 15, 147, z + 12, m));
      out.push(block(x + 2, 135, z + 12, x + 13, 145, z + 18, C.white));
      x += 19;
    } else if (kind === 2) {
      out.push(rod([x, 141, z + 4], [x + 22, 141, z + 4], 4, 4, m));
      out.push(rod([x + 2, 136, z + 4], [x + 20, 136, z + 4], 3.4, 3.4, C.white));
      x += 26;
    } else {
      out.push(orb([x + 7, 140, z + 7], [7, 7, 7], m, { rings: 6, seg: 12 }));
      out.push(orb([x + 7, 138, z + 16], [5, 5, 5], m, { rings: 6, seg: 12 }));
      x += 18;
    }
    i++;
  }
  return out;
}

/* ---------- front frame ---------- */
export function shopfront(cam) {
  const parts = [];
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -200 : 184,
      x1 = x0 + 16;
    parts.push(block(x0 - 3, -33, 0, x1 + 3, -11, 14, C.stone));
    parts.push(
      Object.assign(block(x0, -30, 14, x1, -14, 270, C.pillar), {
        ink: 2.6,
        after: () => couplet(cam, (x0 + x1) / 2, side < 0 ? '生意兴隆' : '财源广进'),
      }),
    );
  }
  parts.push(Object.assign(block(-206, -36, 266, 206, -8, 286, C.timber), { ink: 2.8 }));
  parts.push(block(-212, -42, 286, 212, -4, 294, C.sign));
  parts.push(
    Object.assign(
      slab(
        [
          [-72, -39, 254],
          [72, -39, 254],
          [72, -39, 290],
          [-72, -39, 290],
        ],
        [0, 3, 0],
        C.sign,
      ),
      {
        ink: 2.4,
        after: () =>
          ink(
            path(
              [
                [-68, -39.2, 257],
                [68, -39.2, 257],
                [68, -39.2, 287],
                [-68, -39.2, 287],
              ].map(cam.project),
            ),
            1.4,
            '#e2ab3d',
          ) +
          planeText(
            cam,
            [0, -39.4, 263.5],
            [1, 0, 0],
            [0, 0, 1],
            '鹅掌柜杂货铺',
            17,
            '#ffd56e',
            'font-weight="900" font-family="ui-serif,Songti SC,STSong,serif" letter-spacing="3"',
          ),
      },
    ),
  );
  for (const x of [-140, 140]) {
    parts.push(
      Object.assign(rod([x, -22, 266], [x, -22, 246], 0.5, 0.5, C.ink, { seg: 6 }), { ink: 0.8 }),
    );
    parts.push(rod([x, -22, 247], [x, -22, 243], 6, 6, C.brass));
    parts.push(
      Object.assign(orb([x, -22, 230], [13, 13, 15], C.red, { rings: 9, seg: 18 }), {
        after: () => {
          let s = '';
          for (const dx of [-6, 0, 6]) {
            const pts = Array.from({ length: 7 }, (_, i) => {
              const z = 230 - 13 + (i / 6) * 26,
                r = 13 * Math.sqrt(Math.max(0, 1 - ((z - 230) / 15) ** 2));
              return cam.project([
                x + dx * (r / 13),
                -22 - Math.sqrt(Math.max(0, r * r - dx * dx * (r / 13) ** 2)),
                z,
              ]);
            });
            s += ink(path(pts, false), 0.7, '#8f2c20');
          }
          return (
            s +
            planeText(
              cam,
              [x, -36, 226.5],
              [1, 0, 0],
              [0, 0, 1],
              '福',
              11,
              '#ffd56e',
              'font-weight="900" font-family="ui-serif,Songti SC,serif"',
            )
          );
        },
      }),
    );
    parts.push(rod([x, -22, 216], [x, -22, 212], 6, 6, C.brass));
    parts.push(rod([x, -22, 212], [x, -22, 200], 2.4, 0.8, C.red, { seg: 8 }));
  }
  return parts;
}
function couplet(cam, x, text) {
  const y = -30.3,
    q = [
      [x - 6, y, 60],
      [x + 6, y, 60],
      [x + 6, y, 240],
      [x - 6, y, 240],
    ].map(cam.project);
  let s = `<path d="${path(q)}" fill="#f2543c" stroke="${INK}" stroke-width="1.2"/>`;
  [...text].forEach((ch, i) => {
    s += planeText(
      cam,
      [x, y - 0.2, 214 - i * 42],
      [1, 0, 0],
      [0, 0, 1],
      ch,
      10,
      '#2a1c14',
      'font-weight="800" font-family="ui-serif,Songti SC,serif"',
    );
  });
  return s;
}
