/* Drive This – Car Event Map
   Hides the title pill on mobile while the visitor interacts with the map or scrolls the event cards.
   Pill returns after 2.5 s of inactivity. Desktop unaffected. */
(function () {
  if (window.matchMedia('(min-width: 768px)').matches) return;

  function init() {
    var pill = document.querySelector('.map-title-pill');
    var map = document.querySelector('#map') || document.querySelector('.ncf-map-wrapper');
    var cards = document.querySelector('.cru-ncf-map-item-list');
    if (!pill) return;

    var timer;
    function hide() {
      pill.classList.add('is-hidden');
      clearTimeout(timer);
      timer = setTimeout(function () { pill.classList.remove('is-hidden'); }, 2500);
    }

    [map, cards].forEach(function (el) {
      if (!el) return;
      el.addEventListener('touchstart', hide, { passive: true });
      el.addEventListener('scroll', hide, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
