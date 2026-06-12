/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.0.0 (2026-06-12)
 *
 * Problem: On touch devices the drawer-open chain depends on NCF
 * tooltip / "active" class behavior, which treats the first tap as
 * hover. Tooltip shows, drawer rarely opens. The existing 6px pan
 * threshold also discards legitimate finger taps.
 *
 * Fix: Detect the tap directly on the pin (pointerup with pan +
 * pinch detection, 14px touch threshold) and programmatically click
 * the matching list item. That path already triggers the full
 * openDrawer flow reliably. Desktop untouched (touch-only guard).
 * Tooltips hidden on touch devices via CSS; popups stay visible.
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
      if (li) setTimeout(function () { li.click(); }, 60);
    }, true);

    /* Hide tooltips on touch devices – no hover state exists,
       they only add an extra tap step. Popups stay untouched. */
    var s = document.createElement('style');
    s.id = 'dt-mobile-tap-fix-styles';
    s.textContent = '@media (hover:none) and (pointer:coarse){' +
      '.cru-ncf-tooltip,.ncf-tooltip-pop-up-wrapper,.ncf-tooltip-popup-inner-wrapper' +
      '{display:none!important;}}';
    document.head.appendChild(s);

    console.log('[DT] Mobile pin tap fix v1.0.0 active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
