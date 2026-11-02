import { cardW } from '../cards/constants.js';
import { handPose } from './scene-frame.js';

// 钱袋含袋口和阴影；在牌面接近前，先给整行留出空间。
export function rowClearance(count, layout) {
  if (!count) return 0;
  const edge = handPose(0, count - 1, count, layout).u + (cardW * layout.handScale) / 2;
  const inner = Math.min(Math.abs(layout.bagU) - 38, layout.deckU - (cardW * layout.deckScale) / 2);
  return edge + 12 > inner ? layout.clearanceShift : 0;
}

export function createRowClearance() {
  const rows = [0, 1].map(() => ({ value: 0, from: 0, target: 0, start: 0 }));
  return {
    sample(counts, layout, now) {
      let moving = false;
      const values = rows.map((row, p) => {
        const t = Math.max(0, Math.min(1, (now - row.start) / 320));
        row.value = row.from + (row.target - row.from) * t * t * (3 - 2 * t);
        const target = rowClearance(counts[p], layout);
        if (target !== row.target) {
          row.from = row.value;
          row.target = target;
          row.start = now;
        }
        moving ||= row.value !== row.target;
        return row.value;
      });
      return { values, moving };
    },
  };
}
