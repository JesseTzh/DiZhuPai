import { rod, slab, planeText, path, ink } from '../engine/stage3d.js';

/* The shopkeeper's account book and brush: a stitched book that comes out of the jacket, opens toward the viewer,
 * takes two lines of brushwork and a red ring of approval, then closes again. */
const P = {
  book: ['#5f8c78', '#467060', '#2a463c'],
  page: ['#fffaf0', '#efe7d4', '#cdbf9f'],
  bamboo: ['#e8cf8f', '#c9a961', '#8c703a'],
  ink: ['#3d3832', '#29251e', '#231e16'],
};
export const LEDGER_AT = (pose) => [-47, 60 - pose.ledger * 10, 152 + pose.ledger * 14];
// the book is held up in a plane tipped back from the viewer: u = right, v = up the page, n = out of the page
const PAGE_V = [0, 0.55, 0.84],
  PAGE_N = [0, -0.84, 0.55];
function pageAt(pose) {
  const c = LEDGER_AT(pose);
  return (u, v, n = 0) => [
    c[0] + u,
    c[1] + PAGE_V[1] * v + PAGE_N[1] * n,
    c[2] + PAGE_V[2] * v + PAGE_N[2] * n,
  ];
}
const LW = 15,
  LH = 20;
// account book: back cover, a block of pages, a front cover that swings open around the spine (u = 0)
export function ledger(list, pose) {
  const s = pose.ledger,
    w = LW * s,
    h = LH * s,
    at = pageAt(pose);
  const rect = (u0, u1, n) => [at(u0, -h, n), at(u1, -h, n), at(u1, h, n), at(u0, h, n)];
  list.push(
    Object.assign(
      slab(
        rect(0, w, -1.4),
        PAGE_N.map((v) => v * 1.4),
        P.book,
      ),
      { ink: 1.4 },
    ),
  );
  list.push(
    Object.assign(
      slab(
        rect(0.4, w - 0.8, 0),
        PAGE_N.map((v) => v * 0.8),
        P.page,
      ),
      {
        ink: 0.9,
        after: (cam) => writing(cam, at, w, h, pose),
      },
    ),
  );
  const th = Math.PI * pose.open,
    cu = (d) => d * Math.cos(th),
    cn = (d) => 1 + d * Math.sin(th),
    thick = [0, 1, 2].map((k) => 1.4 * (-Math.sin(th) * [1, 0, 0][k] + Math.cos(th) * PAGE_N[k]));
  const cover = [
    at(cu(0), -h, cn(0)),
    at(cu(w), -h, cn(w)),
    at(cu(w), h, cn(w)),
    at(cu(0), h, cn(0)),
  ];
  const inside = pose.open > 0.5;
  list.push(
    Object.assign(slab(cover, thick, inside ? P.page : P.book), {
      ink: 1.4,
      after: (cam) =>
        inside
          ? ''
          : planeText(
              cam,
              at(cu(w * 0.5), -3 * s, cn(w * 0.5) + 1.5),
              [Math.cos(th), 0, 0],
              PAGE_V,
              '账',
              12 * s,
              '#fff4d6',
              'font-weight="800" font-family="ui-serif,Songti SC,serif"',
            ),
    }),
  );
}
function writing(cam, at, w, h, pose) {
  if (pose.open < 0.7) return '';
  let s = '';
  // two lines of brushwork, then a red ring of approval
  for (let i = 0; i < 2; i++) {
    const k = Math.max(0, Math.min(1, pose.ink - i));
    if (!k) continue;
    const pts = Array.from({ length: 8 }, (_, j) =>
      cam.project(
        at(3 + (j / 7) * (w - 6) * k, h * 0.5 - i * h * 0.42 + Math.sin(j * 1.7 + i) * 1.1, 0.9),
      ),
    );
    s += ink(path(pts, false), 1.7);
  }
  const k = Math.max(0, Math.min(1, pose.ink - 2));
  if (k) {
    const pts = Array.from({ length: 16 }, (_, j) => {
      const a = (j / 15) * Math.PI * 2 * k - 1.2;
      return cam.project(at(w * 0.52 + Math.cos(a) * 4.5, -h * 0.45 + Math.sin(a) * 4.5, 0.9));
    });
    s += ink(path(pts, false), 1.9, '#d0483a');
  }
  return s;
}
// the brush tip follows the stroke being written, dabbing on and off the page
export function brushTip(pose) {
  const at = pageAt({ ...pose, ledger: 1 }),
    i = Math.min(2, Math.floor(pose.ink)),
    k = pose.ink - i,
    lift = Math.abs(Math.sin(pose.write * Math.PI * 7)) * 2 + 0.9;
  if (i < 2) return at(3 + k * (LW - 6), LH * 0.5 - i * LH * 0.42, lift);
  const a = k * Math.PI * 2 - 1.2;
  return at(LW * 0.52 + Math.cos(a) * 4.5, -LH * 0.45 + Math.sin(a) * 4.5, lift);
}
export function brush(list, pose) {
  const tip = brushTip(pose),
    neck = [tip[0] + 1.2, tip[1] - 1.5, tip[2] + 4],
    top = [tip[0] + 12, tip[1] - 7, tip[2] + 30];
  list.push(rod(tip, neck, 0.4, 1.7, P.ink, { seg: 10 }));
  list.push(rod(neck, top, 1.5, 1.5, P.bamboo, { seg: 10 }));
}
