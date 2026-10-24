import { slab, block, rod, drawParts, shadowOf, planeText, path, ink } from './stage3d.js';

/* Colorfigures construction: stone slabs rest on the ground; the timber post is
 * planted beside the path, with an arrow plank nailed across its front.
 * Parts: irregular fieldstones and loose edge chips, post, arrow plank,
 * two iron nails and engraved grain. Each solid has thickness and a sorting box.
 * Reuse the shop's Colorfigures mesh renderer, three-tone light and blue shadows. */
const STONES = [
  ['#ddd9c7', '#b8b49e', '#858674'],
  ['#cbd0c2', '#a7afa0', '#788575'],
  ['#e5d5b9', '#c3b294', '#94856d'],
  ['#d6d6cf', '#b0b2aa', '#7d847b'],
];
// Convex, chipped outlines keep each stone solid under the shared 3D renderer.
const ROCK_PROFILES = [
  [
    [-0.48, -0.18],
    [-0.18, -0.49],
    [0.31, -0.42],
    [0.5, -0.03],
    [0.24, 0.46],
    [-0.3, 0.4],
  ],
  [
    [-0.46, -0.31],
    [0.03, -0.5],
    [0.42, -0.28],
    [0.49, 0.17],
    [0.08, 0.48],
    [-0.5, 0.2],
  ],
  [
    [-0.5, -0.08],
    [-0.3, -0.46],
    [0.2, -0.43],
    [0.5, 0.12],
    [0.12, 0.5],
    [-0.33, 0.29],
  ],
];
const WOOD = ['#e7b779', '#ca9256', '#8e603a'];
const POST = ['#c79a65', '#a47748', '#6f4b30'];
const IRON = ['#ece1be', '#8f8974', '#514d40'];

export function exitPathArtwork(cam) {
  // The first slab overlaps the shop porch (front edge y = -52, top z = 0).
  // Continue outward in the shop's own coordinates and camera, down to the road.
  const signPoint = ([x, y, z]) => [x * 0.65 + 35, y * 0.65 - 210, z * 0.65 - 12];
  const signCam = {
    ...cam,
    project: (p) => cam.project(signPoint(p)),
    axis: (p, d) =>
      cam.axis(
        signPoint(p),
        d.map((v) => v * 0.65),
      ),
  };
  const stones = [];
  // Uneven patches across a winding trail; no repeated treads or straight joints.
  const rocks = [
    [86, -45, 32, 29, -17],
    [117, -52, 26, 32, 24],
    [95, -74, 35, 24, 8],
    [65, -69, 22, 24, -32],
    [119, -82, 18, 21, 37],
    [70, -96, 34, 29, 21],
    [97, -105, 21, 30, -27],
    [44, -103, 19, 22, -9],
    [52, -125, 31, 27, -35],
    [79, -134, 28, 25, 16],
    [25, -133, 18, 20, 28],
    [35, -155, 35, 28, 13],
    [61, -163, 24, 30, -21],
    [9, -163, 17, 23, -38],
    [18, -188, 34, 31, -14],
    [47, -193, 23, 25, 31],
    [-10, -197, 19, 20, 12],
    [26, -214, 23, 17, -28],
    // Loose chips soften the outline rather than forming a second border.
    [139, -65, 9, 12, 18],
    [45, -78, 10, 8, -22],
    [100, -137, 8, 13, 35],
    [2, -137, 11, 9, -4],
    [72, -186, 9, 11, 26],
    [-18, -179, 8, 9, -16],
  ];
  for (const [i, [x, y, w, d, angle]] of rocks.entries()) {
    const a = (angle * Math.PI) / 180;
    const z = y > -64 ? 0 : y > -90 ? -3 : -6;
    const at = ([u, v], lift = 0) => [
      x + u * w * Math.cos(a) - v * d * Math.sin(a),
      y + u * w * Math.sin(a) + v * d * Math.cos(a),
      z + lift,
    ];
    const top = ROCK_PROFILES[i % ROCK_PROFILES.length].map((p) => at(p));
    stones.push(
      slab(top, [0, 0, -3 - (i % 3) * 0.6], STONES[i % STONES.length], {
        label: `exit-stone-${i}`,
        ink: 2.1,
        after: () =>
          w < 20
            ? ''
            : ink(
                path(
                  [at([-0.22, -0.25], 0.1), at([-0.08, -0.14], 0.1), at([-0.14, -0.01], 0.1)].map(
                    cam.project,
                  ),
                  false,
                ),
                0.7,
                '#959482',
              ),
      }),
    );
  }
  const post = block(27, 39, 0, 35, 47, 92, POST, { ink: 2.2 });
  const arrow = slab(
    [
      [-32, 36, 65],
      [107, 36, 65],
      [128, 36, 81],
      [107, 36, 97],
      [-32, 36, 97],
    ],
    [0, 6, 0],
    WOOD,
    {
      label: 'exit-sign',
      ink: 2.8,
      after: () => {
        const grain = [
          [
            [-24, 35.8, 92],
            [2, 35.8, 91],
            [18, 35.8, 92],
          ],
          [
            [67, 35.8, 69],
            [91, 35.8, 70],
            [103, 35.8, 69],
          ],
        ]
          .map((pts) => ink(path(pts.map(signCam.project), false), 0.7, '#986a3f'))
          .join('');
        return (
          grain +
          planeText(
            signCam,
            [40, 35.7, 76],
            [1, 0, 0],
            [0, 0, 1],
            '前往下一关',
            15,
            '#392b20',
            'class="exit-sign-label" font-weight="900" font-family="ui-serif,Songti SC,STSong,serif"',
          )
        );
      },
    },
  );
  const signParts = [post, arrow];
  for (const z of [69, 94])
    signParts.push(rod([31, 35, z], [31, 36, z], 1.5, 1.5, IRON, { seg: 8 }));
  // Transform each shared vertex once, keeping faces, normals and sort boxes valid.
  for (const part of signParts) {
    for (const point of part.points) point.splice(0, 3, ...signPoint(point));
    part.box = part.box.map(signPoint);
  }
  const parts = [...stones, ...signParts];
  const projected = parts.flatMap((part) => part.points.map(cam.project));
  const xs = projected.map(([x]) => x),
    ys = projected.map(([, y]) => y);
  const bounds = {
    x0: Math.min(...xs) - 8,
    x1: Math.max(...xs) + 8,
    y0: Math.min(...ys) - 8,
    y1: Math.max(...ys) + 14,
  };
  return {
    bounds,
    markup: `<g class="exit-path-art" filter="url(#shop-hand)"><g class="exit-path-shadow">${shadowOf(parts, cam, -10)}</g><g class="exit-path-model">${drawParts(parts, cam)}</g></g>`,
  };
}
