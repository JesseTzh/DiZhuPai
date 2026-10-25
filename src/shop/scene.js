import {
  makeCamera,
  block,
  drawParts,
  shadowOf,
  path,
  smooth,
  clamp01,
} from '../engine/stage3d.js';
import { TOYS, buildToy, REST, toyPose, toyDuration, blend } from '../assets/items/index.js';
import { buildGoose, GOOSE_REST, headCentre } from './goose.js';
import { room, shopfront, C, COUNTER_TOP } from './room.js';
import { counter, grille, abacus, deskProps } from './counter.js';
import { goosePurchase, BUY_TIME } from './timelines.js';
import { filterFor } from '../engine/filter.js';
import { SHADOW } from '../engine/palette.js';
import { exitPathArtwork } from './exit-path.js';

/* Mounts the shop diorama: static room and counter drawn once; goose and toys redrawn only while they move. */
export { BUY_TIME };
// Every visit features three toys; the counter keeps three stands and the stocked toys take them in order.
const BASE = Object.fromEntries(Object.entries(TOYS).map(([id, toy]) => [id, toy.shop]));
const FEATURED_X = [-90, 0, 90];
const SLOTS = Object.fromEntries(Object.keys(TOYS).map((id) => [id, null]));
const STAND_H = 4;
const W = 1000;

function frameOf(cam) {
  const pts = [];
  for (const x of [-202, 202]) for (const y of [-52, 166]) pts.push([x, y, -10]);
  for (const x of [-198, 198]) pts.push([x, -36, 298]);
  const pr = pts.map(cam.project),
    xs = pr.map((p) => p[0]),
    ys = pr.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - Math.min(...ys);
  cam.k = (W - 36) / w;
  const H = Math.round(h * cam.k + 46);
  cam.ox = 18 - Math.min(...xs) * cam.k;
  cam.oy = 14 - Math.min(...ys) * cam.k;
  return H;
}

/* ---------- toys on stands ---------- */
const toyMap = (slot) => ({
  p: ([x, y, z]) => [slot.x - x * slot.s, slot.y - y * slot.s, COUNTER_TOP + STAND_H + z * slot.s],
  d: ([x, y, z]) => [-x * slot.s, -y * slot.s, z * slot.s],
  n: ([x, y, z]) => [-x, -y, z],
});
function standParts(slot) {
  const { x, standHalf, standExtend } = slot;
  return [
    Object.assign(
      block(
        x - standHalf,
        slot.y - 13,
        COUNTER_TOP,
        x + standHalf + standExtend,
        slot.y + 13,
        COUNTER_TOP + STAND_H,
        C.white,
      ),
      {
        edges: true,
        edgeW: 0.9,
        ink: 1.6,
      },
    ),
  ];
}

/* ---------- mount ---------- */
export function mountShopScene(svg) {
  const cam = makeCamera({ yaw: 9, pitch: 8, target: [0, 70, 150], dist: 1150 });
  const roomHeight = frameOf(cam);
  const exit = exitPathArtwork(cam);
  const H = Math.ceil(Math.max(roomHeight, exit.bounds.y1 + 18));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const counterTop = [
    [-166, -4, COUNTER_TOP],
    [166, -4, COUNTER_TOP],
    [166, 58, COUNTER_TOP],
    [-166, 58, COUNTER_TOP],
  ].map(cam.project);
  const groundShadow = [
    [-198, -52, -10],
    [214, -52, -10],
    [226, 166, -10],
    [-186, 166, -10],
  ].map(([x, y, z]) => cam.project([x + 14, y + 10, z - 4]));
  svg.innerHTML = `<defs>${filterFor(W / 585)
    .replace('id="hand"', 'id="shop-hand"')
    .replace(
      'id="wob"',
      'id="shop-wob"',
    )}<clipPath id="shop-counter-top"><path d="${path(counterTop)}"/></clipPath></defs>
  <g filter="url(#shop-hand)"><path d="${path(groundShadow)}" fill="${SHADOW}" opacity=".9"/><g id="shop-room">${drawParts(room(cam), cam)}</g></g>
  ${exit.markup}
  <g filter="url(#shop-hand)" id="shop-goose-back"></g>
  <g filter="url(#shop-hand)" id="shop-counter">${drawParts(counter(cam), cam)}${drawParts([...grille(), ...abacus(), ...deskProps()], cam)}${Object.keys(
    SLOTS,
  )
    .map((id) => `<g data-toy-stand="${id}"></g>`)
    .join('')}</g>
  <g filter="url(#shop-hand)" id="shop-goose-front"></g>
  ${Object.keys(SLOTS)
    .map((id) => `<g filter="url(#shop-hand)" class="toy-model" data-toy="${id}"></g>`)
    .join('')}
  <g filter="url(#shop-hand)" id="shop-frame">${drawParts(shopfront(cam), cam)}</g>`;
  const layers = {
    gooseBack: svg.querySelector('#shop-goose-back'),
    gooseFront: svg.querySelector('#shop-goose-front'),
    toys: Object.fromEntries(
      Object.keys(SLOTS).map((id) => [id, svg.querySelector(`[data-toy="${id}"]`)]),
    ),
    stands: Object.fromEntries(
      Object.keys(SLOTS).map((id) => [id, svg.querySelector(`[data-toy-stand="${id}"]`)]),
    ),
  };
  const toys = Object.fromEntries(
    Object.keys(SLOTS).map((id) => [
      id,
      { hover: false, t: 0, out: 1, from: REST[id], pose: REST[id], key: '' },
    ]),
  );
  const goose = {
    pose: GOOSE_REST,
    key: '',
    buy: null,
    idle: 0,
    look: 0,
    glance: 0,
    rub: null,
    blink: null,
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function drawToy(id) {
    const s = toys[id],
      key = JSON.stringify(s.pose);
    if (!SLOTS[id]) {
      if (layers.toys[id].childNodes.length) layers.toys[id].innerHTML = '';
      s.key = key;
      return;
    }
    if (key === s.key) return;
    s.key = key;
    const parts = buildToy(id, s.pose, toyMap(SLOTS[id]));
    layers.toys[id].innerHTML =
      `<g clip-path="url(#shop-counter-top)">${shadowOf(parts, cam, COUNTER_TOP + STAND_H)}</g>` +
      `<g class="toy-body">${drawParts(parts, cam)}</g>`;
  }
  function drawGoose() {
    const key = JSON.stringify(goose.pose);
    if (key === goose.key) return;
    goose.key = key;
    const { back, front } = buildGoose(goose.pose);
    layers.gooseBack.innerHTML = drawParts(back, cam);
    layers.gooseFront.innerHTML = drawParts(front, cam);
  }

  let last = 0,
    running = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let busy = false;
    for (const [id, s] of Object.entries(toys)) {
      if (s.hover) {
        s.t += dt;
        s.pose = motion.matches ? toyPose(id, 99) : toyPose(id, s.t);
        if (s.t < toyDuration(id)) busy = true;
      } else if (s.out < 1 && SLOTS[id]) {
        s.out = Math.min(1, s.out + dt / SLOTS[id].withdraw);
        s.pose = blend(s.from, REST[id], smooth(s.out));
        busy = true;
      }
      drawToy(id);
    }
    // goose
    if (goose.buy != null) {
      goose.buy += dt;
      goose.pose = goosePurchase(motion.matches ? BUY_TIME : goose.buy);
      if (goose.buy >= BUY_TIME) {
        goose.buy = null;
        goose.pose = { ...GOOSE_REST, look: goose.look };
      } else busy = true;
    } else {
      const p = { ...GOOSE_REST };
      goose.glance += (goose.look - goose.glance) * Math.min(1, dt * 9);
      p.look = goose.glance;
      p.lid = goose.look ? 0.3 : GOOSE_REST.lid;
      if (Math.abs(goose.look - goose.glance) > 0.01) busy = true;
      if (goose.blink != null) {
        goose.blink += dt;
        p.blink = Math.sin(clamp01(goose.blink / 0.18) * Math.PI);
        if (goose.blink > 0.18) goose.blink = null;
        else busy = true;
      }
      if (goose.rub != null) {
        goose.rub += dt / 1.6;
        p.rub = Math.min(1, goose.rub);
        if (goose.rub >= 1) goose.rub = null;
        else busy = true;
      }
      goose.pose = p;
    }
    drawGoose();
    if (busy) requestAnimationFrame(frame);
    else running = false;
  }
  const kick = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  // idle life: a blink every few seconds, rubbing the wings now and then
  let idleTimer = 0,
    idleCount = 0;
  const idle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(
      () => {
        if (!svg.isConnected || svg.closest('[hidden]') || motion.matches) return idle();
        if (goose.buy == null) {
          if (++idleCount % 3 === 0) goose.rub = 0;
          else goose.blink = 0;
          kick();
        }
        idle();
      },
      2600 + Math.random() * 1800,
    );
  };
  for (const id of Object.keys(SLOTS)) drawToy(id);
  drawGoose();
  idle();
  return {
    cam,
    height: H,
    exitBounds: exit.bounds,
    width: W,
    // screen boxes (viewBox units) for the hover areas, price cards and the speech bubble
    toyBox(id) {
      if (!SLOTS[id]) return { x0: 0, x1: 0, y0: 0, y1: 0 };
      const pts = [
        ...buildToy(id, REST[id], toyMap(SLOTS[id])),
        ...buildToy(id, toyPose(id, 99), toyMap(SLOTS[id])),
      ]
        .flatMap((p) => p.points)
        .map(cam.project);
      const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    },
    priceAt: (id) =>
      SLOTS[id] ? cam.project([SLOTS[id].x + SLOTS[id].priceOffset, 1, 30]) : [0, 0, 0],
    headAt: () => cam.project(headCentre(GOOSE_REST)),
    hover(id, on) {
      const s = toys[id];
      if (on === s.hover) return;
      s.hover = on;
      if (on) {
        s.t = 0;
        s.out = 1;
      } else {
        s.from = s.pose;
        s.out = 0;
      }
      goose.look = on && SLOTS[id] ? Math.max(-1, Math.min(1, SLOTS[id].x / 90)) : 0;
      kick();
    },
    // Stock the counter: featured toys take the three stands in order, the rest leave the stage.
    setStock(ids) {
      for (const id of Object.keys(SLOTS)) {
        const index = ids.indexOf(id);
        const slot = index < 0 ? null : { ...BASE[id], x: FEATURED_X[index] };
        if (JSON.stringify(slot) === JSON.stringify(SLOTS[id])) continue;
        SLOTS[id] = slot;
        layers.stands[id].innerHTML = slot ? drawParts(standParts(slot), cam) : '';
        layers.stands[id].style.display = slot ? '' : 'none';
        layers.toys[id].style.display = slot ? '' : 'none';
        if (!slot && toys[id].hover) this.hover(id, false);
        toys[id].key = '';
        drawToy(id);
      }
    },
    purchase() {
      goose.buy = 0;
      kick();
    },
    reset() {
      for (const id of Object.keys(SLOTS)) toys[id].hover && this.hover(id, false);
    },
  };
}
