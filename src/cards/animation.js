import { cardIds, cardRad } from './constants.js';
import { ease } from '../engine/shading.js';
export function cardFlip(st, ui, ids = cardIds, faceUp = false) {
  const active = ids.filter(
    (id) => !st.busy[id] && (!faceUp || Math.cos(cardRad(st.flips[id])) < 0),
  );
  if (!active.length) return;
  const starts = active.map((id) => st.flips[id]);
  active.forEach((id) => (st.busy[id] = true));
  let elapsed = 0;
  // A single animation driver updates the whole batch and draws the scene once.
  ui.animate((dt) => {
    elapsed += dt;
    const t = Math.min(1, elapsed / 0.85);
    active.forEach((id, i) => {
      st.flips[id] = starts[i] + 180 * ease(t);
      if (t === 1) {
        st.flips[id] %= 360;
        st.busy[id] = false;
      }
    });
    return t < 1;
  });
}
