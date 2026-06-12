/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.1.0 (2026-06-12)
 *
 * Changes from 1.0.0:
 *  - Overlay click guard: after our programmatic drawer open, the
 *    browser-synthesized click from the original tap can arrive late
 *    (when NCF was busy closing a previous popup) and land on the
 *    now-active drawer overlay, whose handler closes the drawer
 *    immediately (the "flash"). Clicks on the overlay are now
 *    blocked for 600ms after our open.
 *  - NCF popups (.cru-ncf-pop-up) hidden on touch devices, like
 *    tooltips. The drawer covers the screen on mobile anyway, and a
 *    surviving popup from the previous event caused the misplaced
 *    "ghost popup" after panning. Map recentering is unaffected.
 *
 * v1.0.0:
 *  - Direct pin tap detection (pointerup, pan + pinch aware, 14px
 *    touch threshold) -> programmatic list item click -> drawer.
 *  - Tooltips hidden on touch devices. Desktop untouched.
 */
(function () {
  function slugify(n) {
    return n.toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue')
      .replace(/[ß]/g, 'ss').replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a')
      .replace(/[ùûü]/g, 'u').replace(/[îïì]/g, 'i').replace(/[ôöò]/g, 'o')
      .replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function findItem(slug) {
    var items = document.querySelectorAll('.cru-ncf-map-list-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].dataset.slug === slug) return items[i];
      var n = items[i].dataset.name ||
        (items[i].querySelector('h3') || { textContent: '' }).textContent || '';
      if (slugify(n) === slug) return items[i];
    }
    return null;
  }

  /* Overlay click guard – blocks the late synthesized click from the
     original tap so it cannot hit the overlay and close the drawer. */
  var overlayGuardUntil = 0;
  document.addEventListener('click', function (e) {
    if (Date.now() < overlayGuardUntil &&
        e.target.closest && e.target.closest('#dt-drawer-overlay')) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  function init() {
    var mapEl = document.querySelector('.ncf-map-wrapper,.cru-ncf-map,[class*="ncf-map"]');
    if (!mapEl) { setTimeout(init, 500); return; }

    var x = 0, y = 0, pid = null, multi = false;

    mapEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      if (pid !== null) { multi = true; return; } /* second finger = pinch */
      multi = false;
      pid = e.pointerId; x = e.clientX; y = e.clientY;
    }, true);

    mapEl.addEventListener('pointercancel', function () {
      pid = null; multi = false;
    }, true);

    mapEl.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch') return;
      if (e.pointerId !== pid) return;
      pid = null;
      if (multi) return;

      var dx = e.clientX - x, dy = e.clientY - y;
      if (Math.sqrt(dx * dx + dy * dy) > 14) return; /* pan, not a tap */

      var pin = e.target.closest('.cru-ncf-pin');
      if (!pin) return;

      var sc = null, cl = pin.classList;
      for (var i = 0; i < cl.length; i++) {
        if (cl[i].indexOf('ncf-slug-') === 0) { sc = cl[i]; break; }
      }
      if (!sc) return;

      var li = findItem(sc.replace('ncf-slug-', ''));
      if (li) {
        overlayGuardUntil = Date.now() + 600;
        setTimeout(function () { li.click(); }, 60);
      }
    }, true);

    /* Hide tooltips AND popups on touch devices – no hover state
       exists, the drawer replaces the popup on mobile, and surviving
       popups from a previous event cause misplaced ghost popups
       after panning. Map recentering is unaffected. */
    var s = document.createElement('style');
    s.id = 'dt-mobile-tap-fix-styles';
    s.textContent = '@media (hover:none) and (pointer:coarse){' +
      '.cru-ncf-tooltip,.ncf-tooltip-pop-up-wrapper,' +
      '.ncf-tooltip-popup-inner-wrapper,.cru-ncf-pop-up' +
      '{display:none!important;}}';
    document.head.appendChild(s);

    console.log('[DT] Mobile pin tap fix v1.1.0 active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
