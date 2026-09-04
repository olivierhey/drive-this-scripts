/* Drive This – Car Event Map
   Pill auto-hide v1.2 – hides the title pill on mobile while interacting with the map or the event cards.
   Ignores the event drawer, filters and the pill itself. */
(function () {
  if (window.matchMedia('(min-width: 768px)').matches) return;

  var TRIGGERS = '.mapboxgl-canvas-container, .cru-ncf-map-item-list';
  var DELAY = 3500;

  function init() {
    var pill = document.querySelector('.map-title-pill');
    if (!pill) { console.warn('[DT] Pill auto-hide: .map-title-pill not found'); return; }
    console.log('[DT] Pill auto-hide v1.2 active');

    var timer;
    function onInteract(e) {
      if (!e.target || !e.target.closest || !e.target.closest(TRIGGERS)) return;
      pill.classList.add('is-hidden');
      clearTimeout(timer);
      timer = setTimeout(function () { pill.classList.remove('is-hidden'); }, DELAY);
    }

    document.addEventListener('pointerdown', onInteract, { capture: true, passive: true });
    document.addEventListener('touchstart', onInteract, { capture: true, passive: true });
    document.addEventListener('scroll', onInteract, { capture: true, passive: true });
    document.addEventListener('wheel', onInteract, { capture: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
