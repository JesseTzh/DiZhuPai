import { orb, rod, tube, meshFromRings, path, ink, lerp, mixP } from './stage3d.js';
import { LEDGER_AT, ledger, brush, brushTip } from './goose-ledger.js';
import { INK } from '../engine/palette.js';

/* The shopkeeper: a big white goose behind the counter in a merchant's jacket (马褂) and skullcap (瓜皮帽),
 * a monocle on a chain, orange beak with the Chinese goose's knob. Wings come out of the sleeves.
 * Parts: jacket (body), collar, neck (3 rods), head, knob, upper / lower beak, cap dome, cap band, cap bead,
 *        sleeves (upper / fore) and wing tips with three feathers each, ledger (two covers, pages), brush.
 * Pose numbers: look (-1 … 1 left / right), lid (0 open … 1 shut), laugh (0 … 1, eyes ^ ^), beak (0 … 1 open),
 *               tilt (head back), bob, wings R / L (rest, rub, ledger, write), ledger (0 hidden … 1 out),
 *               open (0 … 1), ink (0 … 3 strokes), brush (0 … 1 visible). */
const P = {
  white: ['#fffdf2', '#ebe3d1', '#b9ae98'],
  jacket: ['#6f93c9', '#4f70a8', '#2d4470'],
  trim: ['#ffd56e', '#e2ab3d', '#a8752a'],
  beak: ['#ffae57', '#ec7f2f', '#a8521c'],
  knob: ['#e7783a', '#c45a26', '#82361a'],
  cap: ['#5a524b', '#3d3732', '#26221e'],
  bead: ['#f47b62', '#d6513c', '#8f2c20'],
  book: ['#5f8c78', '#467060', '#2a463c'],
  page: ['#fffaf0', '#efe7d4', '#cdbf9f'],
  bamboo: ['#e8cf8f', '#c9a961', '#8c703a'],
  ink: ['#3d3832', '#29251e', '#231e16'],
  mouth: ['#e46a7e', '#b84a5e', '#7a2e40'],
};
export const GOOSE_REST = {
  look: 0,
  lookDown: 0,
  lid: 0.42,
  blink: 0,
  laugh: 0,
  beak: 0,
  tilt: 0,
  bob: 0,
  rub: 0,
  reach: 0,
  ledger: 0,
  open: 0,
  ink: 0,
  brush: 0,
  write: 0,
  turn: 0,
};
export const GOOSE_X = 0,
  GOOSE_Y = 104;
const X = GOOSE_X,
  Y = GOOSE_Y;

// a dome (upper half of an ellipsoid) closed underneath
function dome(c, r, palette, turn, n = 16) {
  const rings = Array.from({ length: 6 }, (_, j) => {
    const b = (j * Math.PI) / 2 / 5.0001;
    return Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n,
        q = turn([
          r[0] * Math.cos(b) * Math.cos(a),
          r[1] * Math.cos(b) * Math.sin(a),
          r[2] * Math.sin(b),
        ]);
      return q.map((v, k) => v + c[k]);
    });
  });
  return meshFromRings(rings, palette, { caps: true });
}

export function headCentre(pose) {
  return [X + pose.look * 2, Y - 20 + pose.tilt * 2, 214 + pose.bob - pose.lookDown * 3];
}
// head frame: R = the goose's right, Fw = where the beak points, Up; it eyes the customer from a 3/4 turn
function headFrame(pose) {
  const a = ((-24 + pose.look * 26 - pose.lookDown * 6 + pose.turn) * Math.PI) / 180,
    t = (pose.tilt * 22 - pose.lookDown * 24) * (Math.PI / 180);
  const R = [Math.cos(a), Math.sin(a), 0],
    F0 = [Math.sin(a), -Math.cos(a), 0],
    Fw = F0.map((v, k) => v * Math.cos(t) + [0, 0, 1][k] * Math.sin(t)),
    Up = [0, 1, 2].map((k) => [0, 0, 1][k] * Math.cos(t) - F0[k] * Math.sin(t)),
    H = headCentre(pose);
  const L = (x, y, z) => H.map((h, k) => h + x * R[k] + y * Fw[k] + z * Up[k]);
  const turn = (p) => [0, 1, 2].map((k) => p[0] * R[k] + p[1] * Fw[k] + p[2] * Up[k]);
  return { L, turn, R, Fw, Up, H };
}

export function buildGoose(pose) {
  const back = [],
    front = [];
  // jacket body; the counter hides everything under z = 94
  back.push(
    Object.assign(orb([X, Y, 110], [50, 34, 56], P.jacket, { rings: 10, seg: 22 }), {
      ink: 2.6,
      after: (cam) => jacketTrim(cam),
    }),
  );
  // mandarin collar wraps the bottom of the neck
  back.push(
    Object.assign(rod([X, Y - 8, 156], [X, Y - 9, 168], 16, 14, P.jacket), {
      at: [X, Y - 40, 160],
    }),
  );
  const hf = headFrame(pose),
    root = hf.L(0, -7, -7);
  const neck = [
    [X, Y - 9, 162],
    [X + pose.look * 0.6, Y - 5, 178],
    [lerp(X, root[0], 0.7), lerp(Y - 14, root[1], 0.5), 194 + pose.bob * 0.5],
    root,
  ];
  const curve = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    return [0, 1, 2].map(
      (k) =>
        (1 - t) ** 3 * neck[0][k] +
        3 * (1 - t) ** 2 * t * neck[1][k] +
        3 * (1 - t) * t * t * neck[2][k] +
        t ** 3 * neck[3][k],
    );
  });
  back.push(
    tube(
      curve,
      curve.map((_, i) => 12.5 - i * 0.25),
      P.white,
      { ink: 2.2 },
    ),
  );
  head(back, pose, hf);
  // wings: sleeve from the shoulder, wing tip with three feathers
  for (const side of [-1, 1]) wing(front, side, pose);
  if (pose.ledger > 0.01) ledger(front, pose);
  if (pose.brush > 0.01) brush(front, pose);
  return { back, front };
}

function jacketTrim(cam) {
  // front placket, frog buttons and a few coin roundels on the jacket front
  const surf = (x, z) => {
    const q = 1 - ((x - X) / 50) ** 2 - ((z - 110) / 56) ** 2;
    return [x, Y - 34 * Math.sqrt(Math.max(0, q)) - 0.6, z];
  };
  const placket = Array.from({ length: 9 }, (_, i) => surf(X - 2 + i * 0.3, 162 - i * 8)).map(
    cam.project,
  );
  let s = ink(path(placket, false), 1.4);
  for (const z of [152, 139, 126, 113]) {
    const a = cam.project(surf(X - 5, z)),
      b = cam.project(surf(X + 5, z));
    s += ink(path([a, b], false), 2.6, '#e2ab3d') + ink(path([a, b], false), 0.6);
  }
  for (const [x, z] of [
    [-32, 132],
    [28, 138],
    [-20, 106],
    [24, 102],
  ]) {
    const c = cam.project(surf(X + x, z)),
      rr = 5.2 * cam.k;
    s += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${rr.toFixed(1)}" fill="none" stroke="#e2ab3d" stroke-width="1.6"/><rect x="${(c[0] - rr * 0.32).toFixed(1)}" y="${(c[1] - rr * 0.32).toFixed(1)}" width="${(rr * 0.64).toFixed(1)}" height="${(rr * 0.64).toFixed(1)}" fill="none" stroke="#e2ab3d" stroke-width="1.1"/>`;
  }
  return s;
}

function head(list, pose, hf) {
  const { L, turn } = hf;
  list.push(
    Object.assign(orb(hf.H, [14, 19, 14.5], P.white, { rings: 9, seg: 18, turn }), {
      after: (cam) => face(cam, pose, hf),
    }),
  );
  // upper beak, knob on top, lower beak dropping on its hinge when it talks or laughs
  list.push(rod(L(0, 14, -3), L(0, 37, -7), 7, 2.6, P.beak));
  const drop = pose.beak * 0.6;
  list.push(
    rod(L(0, 13, -7), L(0, 13 + 20 * Math.cos(drop), -9 - 20 * Math.sin(drop)), 5, 2.1, P.knob),
  );
  if (pose.beak > 0.05)
    list.push(rod(L(0, 16, -6), L(0, 22, -8 - 4 * pose.beak), 3.6, 2.6, P.mouth));
  list.push(orb(L(0, 13, 4.5), [4.6, 5.5, 4.8], P.knob, { rings: 6, seg: 12, turn }));
  // skullcap: red band, black dome, red bead
  list.push(rod(L(0, -1, 7), L(0, -1, 10), 15.2, 15.2, P.bead, { seg: 18 }));
  list.push(
    Object.assign(dome(L(0, -1, 10), [14.6, 14.6, 10], P.cap, turn), {
      after: (cam) => capSeams(cam, hf),
    }),
  );
  list.push(orb(L(0, -1, 21.5), 3.6, P.bead, { rings: 6, seg: 12 }));
}

function capSeams(cam, hf) {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const pts = Array.from({ length: 6 }, (_, j) => {
      const b = (j / 5) * (Math.PI / 2) * 0.92;
      return hf.L(
        14.6 * Math.cos(b) * Math.cos(a),
        -1 + 14.6 * Math.cos(b) * Math.sin(a),
        10 + 10 * Math.sin(b),
      );
    });
    const n = hf.turn([Math.cos(a), Math.sin(a), 0.6]);
    if (cam.sees(n, pts[1])) s += ink(path(pts.map(cam.project), false), 0.8, '#7a6e62');
  }
  return s;
}

// Eyes, brows and monocle are drawn on the face for the current mood.
function face(cam, pose, hf) {
  let s = '';
  const k = cam.k;
  for (const side of [-1, 1]) {
    const at = hf.L(side * 9, 9, 3.5),
      n = hf.turn([side * 0.7, 0.7, 0.2]);
    if (!cam.sees(n, at)) continue;
    const c = cam.project(at),
      rx = 3.3 * k,
      ry = 3.9 * k;
    const cx = c[0].toFixed(1),
      cy = c[1];
    if (pose.laugh > 0.5) {
      // pleased ^ ^
      s += ink(
        `M${(c[0] - rx * 1.1).toFixed(1)} ${(cy + ry * 0.5).toFixed(1)}Q${cx} ${(cy - ry * 1.6).toFixed(1)} ${(c[0] + rx * 1.1).toFixed(1)} ${(cy + ry * 0.5).toFixed(1)}`,
        2,
      );
      const b = cam.project(hf.L(side * 11, 13, -3));
      s += `<ellipse cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" rx="${(3.4 * k).toFixed(1)}" ry="${(1.9 * k).toFixed(1)}" fill="#f3a6bb" opacity=".85"/>`;
      continue;
    }
    const lid = Math.max(pose.lid, pose.blink);
    if (lid > 0.92) {
      s += ink(
        `M${(c[0] - rx).toFixed(1)} ${cy.toFixed(1)}L${(c[0] + rx).toFixed(1)} ${cy.toFixed(1)}`,
        1.7,
      );
      continue;
    }
    const lidY = cy - ry + 2 * ry * lid,
      id = `goose-eye-${side < 0 ? 'l' : 'r'}`,
      px = c[0] + (pose.look * 1.2 - 0.4) * k,
      py = cy + (0.6 + pose.lookDown * 1.6) * k;
    s += `<clipPath id="${id}"><rect x="${(c[0] - rx * 1.4).toFixed(1)}" y="${lidY.toFixed(1)}" width="${(rx * 2.8).toFixed(1)}" height="${(ry * 3).toFixed(1)}"/></clipPath>`;
    s += `<g clip-path="url(#${id})"><ellipse cx="${cx}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#fffef8" stroke="${INK}" stroke-width="1.2"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(1.9 * k).toFixed(1)}" fill="${INK}"/><circle cx="${(px - 0.6 * k).toFixed(1)}" cy="${(py - 0.7 * k).toFixed(1)}" r="${(0.6 * k).toFixed(1)}" fill="#fff"/></g>`;
    // heavy upper lid and a cocked brow: the merchant is weighing you up
    s += ink(
      `M${(c[0] - rx * 1.2).toFixed(1)} ${(lidY + 0.8).toFixed(1)}L${(c[0] + rx * 1.2).toFixed(1)} ${(lidY - 0.6).toFixed(1)}`,
      1.9,
    );
    const raise = side > 0 ? 3.6 : 1.6;
    s += ink(
      `M${(c[0] - rx * 1.25).toFixed(1)} ${(cy - ry - raise * k + 1.4 * k).toFixed(1)}Q${cx} ${(cy - ry - raise * k - 1.8 * k).toFixed(1)} ${(c[0] + rx * 1.25).toFixed(1)} ${(cy - ry - raise * k + 0.2 * k).toFixed(1)}`,
      1.6,
    );
    if (side > 0) {
      // monocle with a gold chain down to the collar
      const ring = ry * 1.5;
      s += `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${ring.toFixed(1)}" fill="#cfe9f0" fill-opacity=".2" stroke="#a8752a" stroke-width="2.4"/><circle cx="${cx}" cy="${cy.toFixed(1)}" r="${ring.toFixed(1)}" fill="none" stroke="${INK}" stroke-width=".7"/>`;
      s += `<path d="M${(c[0] - ring * 0.55).toFixed(1)} ${(cy - ring * 0.35).toFixed(1)}L${(c[0] - ring * 0.1).toFixed(1)} ${(cy - ring * 0.75).toFixed(1)}" stroke="#fff" stroke-width="1.3" opacity=".8"/>`;
      const end = cam.project([X + 9, Y - 31, 158]);
      s += `<path d="M${(c[0] + ring * 0.6).toFixed(1)} ${(cy + ring * 0.75).toFixed(1)}Q${(c[0] + ring * 1.6).toFixed(1)} ${((cy + end[1]) / 2 + 12 * k).toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}" fill="none" stroke="#a8752a" stroke-width="1.4" stroke-dasharray="1.6 1.2"/>`;
    }
  }
  return s;
}

/* Wing anchors: shoulder → elbow → tip. Rest is on the counter; rub brings both tips together at the chest;
 * reach (right wing) goes inside the jacket for the ledger, then holds the ledger up; write (left wing) holds the brush. */
const REST_TIP = (side) => [X + side * 37, 50, 101];
function wingTip(side, pose) {
  let tip = REST_TIP(side);
  const rub = [
    X + side * 7 + Math.sin(pose.rub * Math.PI * 6) * 3,
    56,
    128 + Math.sin(pose.rub * Math.PI * 6) * side * 2,
  ];
  tip = mixP(
    tip,
    rub,
    Math.min(1, pose.rub > 0 ? 1 : 0) * Math.sin(Math.min(1, pose.rub) * Math.PI) ** 0.4,
  );
  if (side < 0) {
    const inside = [X - 10, Y - 40, 150],
      hold = LEDGER_AT(pose);
    tip = mixP(tip, inside, Math.min(1, pose.reach * 2));
    tip = mixP(tip, [hold[0] - 10, hold[1] + 2, hold[2] - 4], Math.max(0, pose.reach * 2 - 1));
  } else if (pose.brush > 0) {
    tip = mixP(
      tip,
      brushTip(pose).map((v, k) => v + [14, -6, 30][k]),
      pose.brush,
    );
  }
  return tip;
}
function wing(list, side, pose) {
  const shoulder = [X + side * 41, Y - 6, 144],
    tip = wingTip(side, pose),
    elbow = [
      lerp(shoulder[0], tip[0], 0.45) + side * 10,
      lerp(shoulder[1], tip[1], 0.5) - 4,
      lerp(shoulder[2], tip[2], 0.5) - 10,
    ];
  list.push(rod(shoulder, elbow, 14, 12, P.jacket));
  list.push(orb(elbow, 12, P.jacket, { rings: 6, seg: 12 }));
  list.push(rod(elbow, tip, 12, 10.5, P.jacket));
  // wide sleeve cuff, then the white wing tip with three long feathers
  list.push(rod(mixP(elbow, tip, 0.86), tip, 12.5, 12.5, P.trim));
  const dir = tip.map((v, k) => v - elbow[k]),
    len = Math.hypot(...dir),
    d = dir.map((v) => v / len);
  const hand = tip.map((v, k) => v + d[k] * 7);
  list.push(orb(hand, [9, 9, 6.5], P.white, { rings: 7, seg: 14 }));
  for (const j of [-1, 0, 1]) {
    const a = [hand[0] + j * 4, hand[1] + d[1] * 4, hand[2] + d[2] * 4],
      b = [hand[0] + j * 6.5 + d[0] * 10, hand[1] + d[1] * 12 - 2, hand[2] + d[2] * 12 - 1];
    list.push(rod(a, b, 3.6, 2.2, P.white, { seg: 10 }));
  }
}
