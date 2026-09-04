/* Drive This – Car Event Map
   Pill auto-hide v1.1 – hides the title pill on mobile during map/card interaction. */
(function () {
  if (window.matchMedia('(min-width: 768px)').matches) return;

  function init() {
    var pill = document.querySelector('.map-title-pill');
    if (!pill) { console.warn('[DT] Pill auto-hide: .map-title-pill not found'); return; }
    console.log('[DT] Pill auto-hide v1.1 active');

    var timer;
    function hide(e) {
      if (e && e.target && pill.contains(e.target)) return;
      pill.classList.add('is-hidden');
      clearTimeout(timer);
      timer = setTimeout(function () { pill.classList.remove('is-hidden'); }, 2500);
    }

    document.addEventListener('pointerdown', hide, { capture: true, passive: true });
    document.addEventListener('touchstart', hide, { capture: true, passive: true });
    document.addEventListener('scroll', hide, { capture: true, passive: true });
    document.addEventListener('wheel', hide, { capture: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
