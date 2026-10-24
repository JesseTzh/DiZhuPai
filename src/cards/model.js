import { cross, norm, avg, sub, dot } from '../engine/math.js';
import { cardCount, cardOutline, cardRad, cardW, cardThickness } from './constants.js';
export function cardGeometry(id, st) {
  const columns = 9,
    rows = cardCount / columns;
  const turn = cardRad(st.flips[id]),
    theta = cardRad(-45);
  const basisU = [
    Math.cos(theta) * Math.cos(turn),
    Math.sin(theta) * Math.cos(turn),
    -Math.sin(turn),
  ];
  const basisV = [-Math.sin(theta), Math.cos(theta), 0],
    basisN = cross(basisU, basisV);
  const u = ((id % columns) - (columns - 1) / 2) * 76,
    v = (Math.floor(id / columns) - (rows - 1) / 2) * 104;
  const center = [
    75 + (u + v) / Math.SQRT2,
    75 + (-u + v) / Math.SQRT2,
    0.6 + (cardW / 2) * Math.abs(Math.sin(turn)),
  ];
  const point = (u, v, w) =>
    center.map((c, k) => c + u * basisU[k] + v * basisV[k] + w * basisN[k]);
  const ringA = cardOutline.map(([u, v]) => point(u, v, -cardThickness / 2));
  const ringB = cardOutline.map(([u, v]) => point(u, v, cardThickness / 2));
  const all = [...ringA, ...ringB],
    centroid = avg(all);
  const faces = ringA.map((a0, i) => {
    const a1 = ringA[(i + 1) % ringA.length],
      b1 = ringB[(i + 1) % ringB.length],
      b0 = ringB[i];
    let normal = norm(cross(sub(a1, a0), sub(b0, a0)));
    if (dot(normal, sub(avg([a0, a1, b1, b0]), centroid)) < 0) normal = normal.map((n) => -n);
    return { normal, points: [a0, a1, b1, b0] };
  });
  const bounds = [0, 1].map((k) =>
    [0, 1, 2].map((axis) => (k ? Math.max : Math.min)(...all.map((p) => p[axis]))),
  );
  return { point, basisU, basisV, basisN, ringA, ringB, center, all, faces, bounds };
}
