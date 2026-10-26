import { COIN_R, COIN_T } from './coin.js';
import { PUNCH_AT, sackModel } from './sack.js';

/* How it plays out
   1. Rain: coins appear above the frame, tumble down and drop through the open mouth. Each one that passes the
      neck joins the heap inside: the count goes up and the sack fills out (it grows taller and rounder, the creases
      of the empty cloth smooth away), with a small squash as each coin lands. At 40 coins it is full and the heap
      shows in the neck.
   2. Punch: a blow from the viewer's left dents the side and rocks the sack away. The jolt throws about a third of
      the coins out of the mouth; they arc over the shoulder, bounce, and spin down flat on the floor, stacking on
      coins already there. The sack slackens by the coins it lost.
   Units: about 1 per cm; gravity is scaled down so the fall reads. */
export const COIN_FULL = 40;
const GRAVITY = 420,
  GROUND_MAX = 60;

// Seeded so screenshots and ?press= runs repeat exactly.
let seed = 7;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const coinState = () => ({
  count: 0,
  fillShow: 0,
  squash: 0,
  punchT: null,
  punchLeft: 0,
  punchOut: 0,
  rainLeft: 0,
  rainT: 0,
  coins: [],
  running: false,
});

function spawnRain(st, m) {
  const a = rnd() * 2 * Math.PI,
    r = Math.sqrt(rnd()) * 3.4;
  st.coins.push({
    mode: 'rain',
    ox: Math.cos(a) * r,
    oy: Math.sin(a) * r,
    x: 0,
    y: 0,
    z: m.top + 62 + rnd() * 16,
    vz: -40 - rnd() * 30,
    a: rnd() * Math.PI,
    b: rnd() * 2 * Math.PI,
    psi: 0,
    wa: (rnd() - 0.5) * 16,
    wb: (rnd() - 0.5) * 6,
    wp: (rnd() - 0.5) * 8,
  });
}

// Thrown out of the mouth away from the blow, far enough to clear the shoulder and land on the floor.
function spawnSpill(st, m) {
  const [ax, ay] = m.axis(m.top),
    a = rnd() * 2 * Math.PI,
    r = rnd() * 4;
  const z0 = m.rimZ - 1,
    vz = 90 + rnd() * 80,
    T = (vz + Math.sqrt(vz * vz + 2 * GRAVITY * z0)) / GRAVITY;
  const dir = PUNCH_AT + Math.PI + (rnd() - 0.5) * 3,
    d = m.Rb + 11 + rnd() * (44 - m.Rb - 11),
    hs = d / T;
  st.coins.push({
    mode: 'fly',
    x: ax + Math.cos(a) * r,
    y: ay + Math.sin(a) * r,
    z: z0,
    vx: Math.cos(dir) * hs,
    vy: Math.sin(dir) * hs,
    vz,
    a: rnd() * Math.PI,
    b: rnd() * 2 * Math.PI,
    psi: 0,
    wa: (rnd() - 0.5) * 18,
    wb: (rnd() - 0.5) * 8,
    wp: (rnd() - 0.5) * 10,
    bounces: 0,
  });
}

// Height of the half-thickness-free contact: a tilted disc rests on its edge.
const reach = (a) => COIN_R * Math.abs(Math.sin(a)) + (COIN_T / 2) * Math.abs(Math.cos(a));
// The floor under (x, y): the top of any coin already lying there.
function floorAt(st, c) {
  let z = 0;
  for (const q of st.coins)
    if (q !== c && q.mode === 'rest' && Math.hypot(q.x - c.x, q.y - c.y) < COIN_R * 1.5)
      z = Math.max(z, q.z + COIN_T / 2);
  return z;
}

export function coinStep(st, dt) {
  const m = sackModel(st);
  if (st.rainLeft > 0) {
    st.rainT -= dt;
    while (st.rainT <= 0 && st.rainLeft > 0) {
      spawnRain(st, m);
      st.rainLeft--;
      st.rainT += 0.075;
    }
  }
  if (st.punchT != null) {
    st.punchT += dt;
    while (st.punchLeft > 0 && st.count > 0 && st.punchT > 0.05 + st.punchOut * 0.022) {
      spawnSpill(st, m);
      st.punchLeft--;
      st.punchOut++;
      st.count--;
    }
    if (st.punchT > 1.8) st.punchT = null;
  }
  for (const c of st.coins) {
    if (c.mode === 'rest') continue;
    c.b += c.wb * dt;
    c.psi += c.wp * dt;
    if (c.mode === 'rain') {
      // falls straight down the mouth's axis, drifting in toward it
      c.vz -= GRAVITY * dt;
      c.z += c.vz * dt;
      c.a += c.wa * dt;
      const k = 0.55 + 0.45 * Math.min(1, Math.max(0, (c.z - m.top) / 50)),
        [ax, ay] = m.axis(c.z);
      c.x = ax + c.ox * k;
      c.y = ay + c.oy * k;
      if (c.z < m.Hb) {
        c.done = true;
        st.count = Math.min(COIN_FULL, st.count + 1);
        st.squash = 0.045;
      }
    } else if (c.mode === 'fly') {
      c.vz -= GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.a += c.wa * dt;
      const floor = floorAt(st, c);
      if (c.vz < 0 && c.z - reach(c.a) <= floor) {
        c.z = floor + reach(c.a);
        c.vz = -c.vz * 0.32;
        c.vx *= 0.55;
        c.vy *= 0.55;
        c.wa *= 0.4;
        if (++c.bounces >= 2 || c.vz < 30) {
          c.mode = 'settle';
          c.floor = floor;
          c.wb = (c.wb >= 0 ? 1 : -1) * 12;
          c.a = ((c.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          if (c.a > Math.PI) c.a = 2 * Math.PI - c.a;
        }
      }
    } else if (c.mode === 'settle') {
      // the spin-down of a coin rolling on its edge: the tilt dies away while it wobbles faster
      const target = c.a < Math.PI / 2 ? 0 : Math.PI;
      c.a += (target - c.a) * (1 - Math.exp(-5 * dt));
      c.vx *= Math.exp(-7 * dt);
      c.vy *= Math.exp(-7 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z = c.floor + reach(c.a);
      if (Math.abs(c.a - target) < 0.01) {
        c.a = target;
        c.mode = 'rest';
        c.z = c.floor + COIN_T / 2;
      }
    }
  }
  st.coins = st.coins.filter((c) => !c.done);
  const resting = st.coins.filter((c) => c.mode === 'rest');
  if (resting.length > GROUND_MAX) {
    const old = new Set(resting.slice(0, resting.length - GROUND_MAX));
    st.coins = st.coins.filter((c) => !old.has(c));
  }
  const target = st.count / COIN_FULL;
  st.fillShow += (target - st.fillShow) * (1 - Math.exp(-5 * dt));
  if (Math.abs(target - st.fillShow) < 0.002) st.fillShow = target;
  st.squash *= Math.exp(-10 * dt);
  if (st.squash < 0.002) st.squash = 0;
  return (
    st.rainLeft > 0 ||
    st.punchT != null ||
    st.coins.some((c) => c.mode !== 'rest') ||
    st.fillShow !== target ||
    st.squash > 0
  );
}
