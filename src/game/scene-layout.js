/* Per-mode table geometry, viewed from a shallow overhead angle.
 * The phone mode frames only the area that matters:
 * rows sit closer and cards are drawn larger. The board stays inside its
 * viewport with a small gap from the status bar and screen edges.
 * Units are world coordinates (u across the table, v from the computer's rows
 * toward the player's rows).
 *
 * Every consumer (scene, renderer, controller) picks one layout up front, so
 * tuning one mode keeps the other mode's card geometry independent. */
export const GAME_CAMERA = { pitch: 72, distance: 2400 };

export const DESKTOP_LAYOUT = {
  // Rows 0 (player) and 1 (computer); bags, decks and hands all sit on these.
  rowV: [150, -174],
  handSpacing: 27,
  handSpan: 620,
  handScale: 1.03,
  playScale: 0.94,
  playV: -32,
  playGap: 42,
  deckScale: 0.82,
  selectedLift: 22,
  bagU: -350,
  deckU: 350,
  clearanceShift: 120,
  // 道具从玩家左下桌沿向右摆放。
  itemLayout: { insetU: 42, insetV: 16, step: 34, scale: 0.28 },
  // Keep cards and collectibles visible without extra camera padding.
  bounds: { u0: -396, u1: 396, v0: -236, v1: 236 },
  // Action pills are drawn at this fraction of their desktop size.
  actionScale: 0.85,
};

export const MOBILE_LAYOUT = {
  /* Rows hug the middle. Their separation has to hold the played card plus the
   * action pills between them, and the total height sets the card size on a
   * landscape phone, so these are tuned together. */
  rowV: [134, -142],
  // Wide enough to tap the exposed strip of an 18-card hand without covering it.
  handSpacing: 30,
  // Long hands (steals, late rounds) tighten up instead of growing over the sacks.
  handSpan: 540,
  handScale: 1.15,
  playScale: 1,
  playV: -32,
  playGap: 42,
  deckScale: 0.95,
  // A small lift keeps the raised card clear of the action pills.
  selectedLift: 10,
  bagU: -342,
  deckU: 342,
  clearanceShift: 84,
  // 道具沿玩家左下桌沿排列，为手牌保留整行空间。
  itemLayout: { insetU: 38, insetV: 14, step: 32, scale: 0.25 },
  // 取景包含两侧牌堆、手牌和玩家下桌沿的道具，四边保留留白。
  bounds: { u0: -384, u1: 384, v0: -220, v1: 220 },
  // Action pills grow with the table but stay out of the card rows.
  actionScale: 0.8,
};

export const layoutFor = (mobile) => (mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT);
