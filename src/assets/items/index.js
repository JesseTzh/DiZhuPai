import { lerp, orb as orbMesh, rod as rodMesh } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';
import { frog } from './frog.js';
import { hand } from './hand.js';
import { dragon } from './dragon.js';
import { stamp } from './stamp.js';
import { balance } from './balance.js';
import { mask } from './mask.js';
import { mouse } from './mouse.js';

/* 道具玩具美术注册表：一个道具一个文件（frog.js / hand.js / dragon.js / stamp.js / balance.js / mask.js / mouse.js），
 * 统一在此聚合。商店柜台（shop/scene.js）、游戏桌面（game/table-items.js）与顶栏图标（ui/topbar-art.js）
 * 都从这里取同一份几何体、动画与摆放配置。新增道具见 README.md。 */
export const TOYS = { frog, hand, dragon, stamp, balance, mask, mouse };

export const REST = Object.fromEntries(Object.entries(TOYS).map(([id, toy]) => [id, toy.REST]));

// A model collects convex parts; map places toy units in the world (identity for the table geometry).
function model(map = null) {
  const parts = [];
  const P = map ? map.p : (p) => p,
    D = map ? map.d : (d) => d;
  const place = (part) => {
    if (!map) {
      part.box ||= [0, 1].map((end) =>
        [0, 1, 2].map((a) => (end ? Math.max : Math.min)(...part.points.map((p) => p[a]))),
      );
      return part;
    }
    const points = part.points.map(P);
    const lookup = new Map(part.points.map((p, i) => [p, points[i]]));
    part.faces = part.faces.map((face) => ({
      points: face.points.map((p) => lookup.get(p) || P(p)),
      normal: map.n(face.normal),
    }));
    part.points = points;
    part.box = [0, 1].map((end) =>
      [0, 1, 2].map((a) => (end ? Math.max : Math.min)(...points.map((p) => p[a]))),
    );
    if (part.at) part.at = P(part.at);
    if (part.outline) {
      const scale = Math.hypot(...D([1, 0, 0]));
      part.outline = {
        ...part.outline,
        centres: part.outline.centres.map(P),
        radii: part.outline.radii.map((r) => r * scale),
      };
    }
    return part;
  };
  const add = (part, extra = {}) => {
    Object.assign(part, extra);
    parts.push(place(part));
    return part;
  };
  return {
    parts,
    P,
    D,
    orb: (x, y, z, rx, ry, rz, m, label = '', res = {}) =>
      add(orbMesh([x, y, z], [rx, ry, rz], palettes[m], res), label ? { label } : {}),
    rod: (a, b, r, m, end = r, label = '', joint = true) => {
      add(rodMesh(a, b, r, end, palettes[m]), label ? { label } : {});
      if (joint) add(orbMesh(b, end, palettes[m], { rings: 6, seg: 12 }));
    },
    add,
  };
}

export function buildToy(id, pose, map) {
  const m = model(map);
  TOYS[id].build(m, { ...REST[id], ...pose });
  return m.parts;
}
const geometryCache = new Map();
export function toyGeometry(id) {
  if (!geometryCache.has(id)) geometryCache.set(id, buildToy(id, TOYS[id].tablePose || {}));
  return geometryCache.get(id);
}
export const toyPose = (id, t) => TOYS[id].pose(t);
export const toyDuration = (id) => TOYS[id].duration;
export const blend = (a, b, t) =>
  Object.fromEntries(Object.keys(b).map((k) => [k, lerp(a[k] ?? b[k], b[k], t)]));
