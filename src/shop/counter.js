import { orb, rod, block, slab, planeText, path, ink } from './stage3d.js';
import { INK } from '../engine/palette.js';
import { C, COUNTER_TOP } from './room.js';

/* The pawnshop counter: plinth, lacquered body with framed panels and brass coins, wood top; a grille at the
 * left end, an abacus propped on account books, and the desk things at the right end. */
export function counter(cam) {
  const parts = [];
  parts.push(block(-162, 2, 0, 162, 54, 8, C.panel));
  parts.push(
    Object.assign(block(-158, 4, 8, 158, 50, 86, C.lacquer), {
      ink: 2.6,
      after: () => counterFront(cam),
    }),
  );
  for (const x of [-158, -95, -32, 32, 95, 152]) parts.push(block(x, 1, 8, x + 6, 4, 86, C.panel));
  parts.push(Object.assign(block(-166, -4, 86, 166, 58, COUNTER_TOP, C.top), { ink: 2.6 }));
  for (const x of [-166, 160]) parts.push(block(x, -5, 84, x + 6, 1, COUNTER_TOP + 1, C.brass));
  return parts;
}
function counterFront(cam) {
  let s = '';
  const y = 3.6;
  const xs = [-152, -95, -32, 32, 95, 152];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + 8,
      b = xs[i + 1] - 4;
    const q = [
      [a, y, 18],
      [b, y, 18],
      [b, y, 76],
      [a, y, 76],
    ].map(cam.project);
    s += `<path d="${path(q)}" fill="${C.panel[1]}" stroke="${INK}" stroke-width="1.3"/>`;
    const inner = [
      [a + 4, y - 0.1, 22],
      [b - 4, y - 0.1, 22],
      [b - 4, y - 0.1, 72],
      [a + 4, y - 0.1, 72],
    ].map(cam.project);
    s += ink(path(inner), 0.8, '#e2ab3d');
    if (i === 2) continue;
    const c = cam.project([(a + b) / 2, y - 0.2, 47]),
      r = 9 * cam.k;
    s += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r.toFixed(1)}" fill="${C.brass[1]}" stroke="${INK}" stroke-width="1.3"/><rect x="${(c[0] - r * 0.33).toFixed(1)}" y="${(c[1] - r * 0.33).toFixed(1)}" width="${(r * 0.66).toFixed(1)}" height="${(r * 0.66).toFixed(1)}" fill="${C.panel[1]}" stroke="${INK}" stroke-width="1"/>`;
  }
  // centre panel: the shop's motto on a gold plaque
  const plaque = [
    [-22, y - 0.3, 34],
    [22, y - 0.3, 34],
    [22, y - 0.3, 62],
    [-22, y - 0.3, 62],
  ].map(cam.project);
  s += `<path d="${path(plaque)}" fill="${C.brass[0]}" stroke="${INK}" stroke-width="1.4"/>`;
  s += planeText(
    cam,
    [0, y - 0.4, 44],
    [1, 0, 0],
    [0, 0, 1],
    '童叟无欺',
    9.5,
    '#6a2c1f',
    'font-weight="800" font-family="ui-serif,Songti SC,serif" letter-spacing="1"',
  );
  return s;
}
// the pawnshop grille: posts and bars standing at the back edge of the counter's left end
export function grille() {
  const parts = [];
  const x0 = -164,
    x1 = -118,
    y = 50;
  parts.push(block(x0, y, COUNTER_TOP, x0 + 5, y + 5, 196, C.timber));
  parts.push(block(x1 - 5, y, COUNTER_TOP, x1, y + 5, 196, C.timber));
  parts.push(block(x0, y - 1, 190, x1, y + 6, 198, C.timber));
  parts.push(block(x0, y - 1, 108, x1, y + 6, 114, C.timber));
  for (let x = x0 + 9; x < x1 - 6; x += 6.5)
    parts.push(rod([x, y + 2.5, 114], [x, y + 2.5, 190], 1.3, 1.3, C.timber, { seg: 8 }));
  // hanging price board
  parts.push(
    Object.assign(
      slab(
        [
          [-158, y - 2, 152],
          [-124, y - 2, 152],
          [-124, y - 2, 176],
          [-158, y - 2, 176],
        ],
        [0, 1.6, 0],
        C.red,
      ),
      {
        ink: 1.4,
        after: (cam) =>
          planeText(
            cam,
            [-141, y - 2.2, 160],
            [1, 0, 0],
            [0, 0, 1],
            '当日',
            10,
            '#fff4d6',
            'font-weight="800" font-family="ui-serif,Songti SC,serif"',
          ),
      },
    ),
  );
  return parts;
}
// abacus propped against a stack of thread-bound account books
export function abacus() {
  const parts = [];
  parts.push(block(-160, 38, COUNTER_TOP, -122, 54, COUNTER_TOP + 6, C.bookB));
  parts.push(block(-158, 40, COUNTER_TOP + 6, -124, 53, COUNTER_TOP + 11, C.book));
  // frame plane leaning back: u = x, v = up and away
  const lean = (62 * Math.PI) / 180,
    V = [0, Math.cos(lean), Math.sin(lean)],
    N = [0, -Math.sin(lean), Math.cos(lean)],
    base = [-163, 22, COUNTER_TOP],
    at = (u, v, n = 0) => [
      base[0] + u,
      base[1] + V[1] * v + N[1] * n,
      base[2] + V[2] * v + N[2] * n,
    ];
  const bar = (u0, v0, u1, v1, m = C.bead) =>
    slab(
      [at(u0, v0, -1.5), at(u1, v0, -1.5), at(u1, v1, -1.5), at(u0, v1, -1.5)],
      N.map((q) => q * 3.2),
      m,
    );
  const Wd = 44,
    Hd = 26;
  parts.push(
    bar(0, 0, Wd, 2.6),
    bar(0, Hd - 2.6, Wd, Hd),
    bar(0, 0, 2.6, Hd),
    bar(Wd - 2.6, 0, Wd, Hd),
  );
  parts.push(bar(2.6, 18, Wd - 2.6, 19.6, C.timber));
  for (let i = 0; i < 9; i++) {
    const u = 6 + i * 4;
    parts.push(rod(at(u, 2.6), at(u, Hd - 2.6), 0.4, 0.4, C.timber, { seg: 6 }));
    // beads: a few pushed up to the beam, as if a sum is set
    const up = (i * 5 + 3) % 4,
      top = i % 3 === 0 ? 1 : 0;
    for (let j = 0; j < 5; j++) {
      const v = j < up ? 15.6 - (up - 1 - j) * 2.4 : 3.8 + j * 2.4;
      parts.push(orb(at(u, v), [1.9, 1.2, 1.2], C.bead, { rings: 4, seg: 8, turn: tilt(V, N) }));
    }
    for (let j = 0; j < 2; j++)
      parts.push(
        orb(at(u, top ? 20.8 + j * 2.4 : 21.6 + j * 2.4), [1.9, 1.2, 1.2], C.bead, {
          rings: 4,
          seg: 8,
          turn: tilt(V, N),
        }),
      );
  }
  return parts;
}
// orb local (x, y, z) → frame u, out of plane n, along the rod v
const tilt = (V, N) => (p) => [p[0], V[1] * p[2] + N[1] * p[1], V[2] * p[2] + N[2] * p[1]];

export function deskProps() {
  const parts = [];
  // ink stone and an ink stick
  parts.push(block(118, 34, COUNTER_TOP, 140, 50, COUNTER_TOP + 4, C.ink));
  parts.push(block(131, 37, COUNTER_TOP + 4, 136, 47, COUNTER_TOP + 6, C.ink));
  // brush pot with three brushes
  parts.push(rod([150, 44, COUNTER_TOP], [150, 44, COUNTER_TOP + 18], 7, 7, C.pot));
  for (const [dx, dy, lean] of [
    [-3, 0, -5],
    [2, -2, 3],
    [3, 2, 7],
  ])
    parts.push(
      rod(
        [150 + dx, 44 + dy, COUNTER_TOP + 14],
        [150 + dx + lean, 44 + dy, COUNTER_TOP + 36],
        1.1,
        1.1,
        C.bookB,
        { seg: 8 },
      ),
    );
  // a string of copper coins
  for (let i = 0; i < 5; i++)
    parts.push(
      rod(
        [118 + i * 0.4, 18, COUNTER_TOP + i * 1.6],
        [118 + i * 0.4, 18, COUNTER_TOP + 1.4 + i * 1.6],
        5,
        5,
        C.brass,
        { seg: 16 },
      ),
    );
  // service bell
  parts.push(rod([146, 14, COUNTER_TOP], [146, 14, COUNTER_TOP + 2], 7, 7, C.ink));
  parts.push(orb([146, 14, COUNTER_TOP + 2], [6, 6, 7], C.brass, { rings: 6, seg: 14 }));
  return parts;
}
