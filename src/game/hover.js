// Hand-card hover lift with bounded travel: enter in 80 ms, return in 50 ms, no easing tail.
// Progress is a function of time, so the scene's one frame driver can sample it in any frame.
const ENTER_MS = 80,
  LEAVE_MS = 50;

export function createHover() {
  const tracks = new Map(); // card id → { from, at, target }
  let current = null;
  const value = ({ from, at, target }, now) =>
    target ? Math.min(1, from + (now - at) / ENTER_MS) : Math.max(0, from - (now - at) / LEAVE_MS);
  const aim = (id, target, now) => {
    const track = tracks.get(id);
    tracks.set(id, { from: track ? value(track, now) : 0, at: now, target });
  };
  return {
    // Point at a card (or null); returns whether anything has to move.
    set(id, now) {
      if (id === current) return false;
      if (current != null) aim(current, 0, now);
      if (id != null) aim(id, 1, now);
      current = id;
      return true;
    },
    // Progress per card at `now`, and whether any card is still travelling.
    sample(now) {
      const values = new Map();
      let moving = false;
      for (const [id, track] of tracks) {
        const v = value(track, now);
        if (v === 0 && !track.target) tracks.delete(id);
        else values.set(id, v);
        moving ||= v !== track.target;
      }
      return { values, moving };
    },
  };
}
