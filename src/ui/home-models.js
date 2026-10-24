import { ModelCanvas } from '../game/model-canvas.js';
import { cpuArt } from '../game/cpu-art.js';
import { PALS } from '../engine/palette.js';
import { cameraView, setCameraPitch } from '../engine/camera.js';

// Render the game's real meshes and prints once, then move their retained image nodes.
export async function homeModelArt() {
  const art = await cpuArt();
  const view = cameraView();
  setCameraPitch(90);
  const sprite = (draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.translate(128, 128);
    ctx.scale(2, 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const painter = ModelCanvas.forContext(ctx);
    draw(painter, ctx);
    return canvas.toDataURL();
  };
  const cards = [0, 18, 36].map((id) =>
    sprite((painter, ctx) => {
      ctx.rotate(Math.PI / 2);
      const model = painter.cardGeometry({ u: 0, v: 0, z: 2, scale: 0.78 });
      painter.card(model, art.fronts[id], {});
    }),
  );
  let mouth;
  const bag = sprite((painter, ctx) => {
    const state = { fillShow: 0.58, squash: 0, punchT: null, coins: [] };
    const model = painter.sackGeometry(state, 'home');
    // Tilt the home sprite independently from the table's adjustable camera.
    const pitch = (76 * Math.PI) / 180;
    const rotate = ([x, y, z]) => {
      const across = (x - y) / Math.SQRT2;
      const depth = (x + y) / Math.SQRT2;
      const tilted = depth * Math.cos(pitch) - z * Math.sin(pitch);
      return [
        (tilted + across) / Math.SQRT2,
        (tilted - across) / Math.SQRT2,
        depth * Math.sin(pitch) + z * Math.cos(pitch),
      ];
    };
    const point = ([x, y, z]) => {
      const q = rotate([x - 48, y - 48, z - 24]);
      return [q[0] + 48, q[1] + 48, q[2]];
    };
    const mesh = (part) => ({
      rings: part.rings.map((ring) => ring.map(point)),
      faces: part.faces.map(({ q, n }) => ({ q: q.map(point), n: rotate(n) })),
      normals: part.normals.map((row) => row.map(rotate)),
    });
    const m = model.m;
    const side = {
      ...model,
      m: {
        ...m,
        shell: m.shell.map((ring) => ring.map(point)),
        surf: (...args) => point(m.surf(...args)),
        normal: (...args) => rotate(m.normal(...args)),
        at: (...args) => point(m.at(...args)),
      },
      body: mesh(model.body),
      outer: mesh(model.outer),
      inner: mesh(model.inner),
      weave: model.weave.map((line) => ({
        ...line,
        points: line.points.map(point),
        normals: line.normals.map(rotate),
      })),
    };
    const rim = point(m.axis(m.top));
    const [x, y] = painter.project([rim[0] - 48, rim[1] - 48, rim[2]]);
    mouth = { x, y };
    ctx.fillStyle = '#41538f30';
    ctx.beginPath();
    ctx.ellipse(-8, 35, 37, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    painter.sack(side, state, PALS.cobalt, [0, 0, 0], 1, art.coin);
  });
  setCameraPitch(view.pitch, view.distance);
  return { cards, bag, mouth };
}
