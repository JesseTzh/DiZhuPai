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
  handSpan: null,
  handScale: 1.03,
  playScale: 0.94,
  playV: -32,
  playGap: 42,
  deckScale: 0.82,
  selectedLift: 22,
  bagU: -350,
  deckU: 350,
  // 道具沿桌面左侧排列，避开底部手牌和钱袋。
  itemLayout: { u: -352, v: -80, step: 24, scale: 0.32 },
  // Keep cards and collectibles visible without extra camera padding.
  bounds: { u0: -396, u1: 396, v0: -236, v1: 236 },
  // Action pills are drawn at this fraction of their desktop size.
  actionScale: 1,
};

export const MOBILE_LAYOUT = {
  /* Rows hug the middle. Their separation has to hold the played card plus the
   * action pills between them, and the total height sets the card size on a
   * landscape phone, so these are tuned together. */
  rowV: [134, -142],
  // Wide enough to tap the exposed strip of an 18-card hand without covering it.
  handSpacing: 30,
  // Long hands (steals, late rounds) tighten up instead of growing over the sacks.
  handSpan: 500,
  handScale: 1.15,
  playScale: 1,
  playV: -32,
  playGap: 42,
  deckScale: 0.95,
  // A small lift keeps the raised card clear of the action pills.
  selectedLift: 10,
  bagU: -342,
  deckU: 342,
  /* Toys line the free left edge between the two sacks, oldest at the player's
   * end, instead of below the hand where they would eat vertical space. */
  itemLayout: { u: -352, v: -78, step: 26, scale: 0.28 },
  /* Straight-down frame around everything the player acts on: toy column
   * (-366) to the decks on the right (372); center both axes and include the
   * computer's card tops (-191) and the status line beneath the hand (208). */
  bounds: { u0: -384, u1: 384, v0: -208, v1: 208 },
  // Action pills grow with the table but stay out of the card rows.
  actionScale: 0.8,
};

export const layoutFor = (mobile) => (mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT);
