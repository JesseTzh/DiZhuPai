export function bindGameKeyboard(
  game,
  { canAct, select, playerPlay, playerPass, hint, clearSelection },
) {
  document.getElementById('fig').addEventListener('keydown', (e) => {
    if (e.target.closest('[data-act="poke-bag"]') && [' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
      e.target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      return;
    }
    const card = e.target.closest('[data-card]');
    if (card && [' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      select(+card.dataset.card);
    }
  });
  addEventListener('keydown', (e) => {
    if (e.repeat || /input|textarea|summary/i.test(e.target.tagName) || !canAct()) return;
    if (e.key === 'Enter' && !e.target.closest('button,[data-card]')) {
      e.preventDefault();
      playerPlay();
    }
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      playerPass();
    }
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      hint();
    }
    if (e.key === 'Escape') clearSelection();
    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const cards = [...document.querySelectorAll('.hand-card')].sort(
        (a, b) => game.hands[0].indexOf(+a.dataset.card) - game.hands[0].indexOf(+b.dataset.card),
      );
      const index = cards.indexOf(document.activeElement),
        next =
          index < 0 ? 0 : (index + (e.key === 'ArrowLeft' ? -1 : 1) + cards.length) % cards.length;
      cards[next]?.focus();
    }
  });
}
