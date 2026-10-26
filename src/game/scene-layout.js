/* Per-mode table geometry. Desktop keeps the full, slightly tilted tabletop.
 * The phone mode looks straight down and frames only the area that matters:
 * rows sit closer, cards are drawn larger and the board runs to the edges, so a
 * wide phone screen is used edge to edge.
 * Units are world coordinates (u across the table, v from the computer's rows
 * toward the player's rows).
 *
 * Every consumer (scene, renderer, controller) picks one layout up front, so the
 * desktop numbers stay exactly as they were and phone tuning cannot reach them. */
export const DESKTOP_LAYOUT = {
  // Rows 0 (player) and 1 (computer); bags, decks and hands all sit on these.
  rowV: [180, -165],
  handSpacing: 24,
  handSpan: null,
  handScale: 0.86,
  playScale: 0.86,
  playGap: 42,
  deckScale: 0.82,
  selectedLift: 22,
  bagU: -315,
  deckU: 315,
  // Collectibles keep their authored corner below the player's hand.
  itemLayout: null,
  // Whole tabletop plus the usual breathing room.
  bounds: null,
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
   * (-366) to the decks on the right (372); the computer's card tops (-191) down
   * to the player's hand and the status line beneath it (208). */
  bounds: { u0: -384, u1: 378, v0: -198, v1: 208 },
  // Action pills grow with the table but stay out of the card rows.
  actionScale: 0.8,
};

export const layoutFor = (mobile) => (mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT);
