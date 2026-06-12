/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.2.0 (2026-06-12)
 *
 * Changes from 1.1.0:
 *  - Broad click guard: for 700ms after our programmatic open, ALL
 *    clicks landing inside #dt-drawer or #dt-drawer-overlay are
 *    blocked. The late browser-synthesized click from the original
 *    tap can land anywhere under the tap point, and the bottom sheet
 *    covers 86vh, so it can hit the close button (-> instant close,
 *    the "flash") or the CTA (-> unwanted navigation).
 *  - Watchdog: if the drawer is not active ~400ms and ~800ms after
 *    our open attempt, the list item click is retried once. Covers
 *    any close path we have not identified yet.
 *  - On-screen debug panel, enabled with ?dtdebug=1 in the URL.
 *    Logs pointer/touch/click events and drawer open/close
 *    transitions with ms timestamps. No effect without the param.
 *
 * v1.1.0: overlay click guard, NCF popups hidden on touch.
 * v1.0.0: direct pin tap detection -> programmatic list item click.
 */
(function () {

  /* ── Debug panel (only with ?dtdebug=1) ── */
  var DEBUG = /[?&]dtdebug=1/.test(window.location.search);
  var dbgEl = null, t0 = Date.now();
  function dlog(msg) {
    if (!DEBUG) return;
    if (!dbgEl) {
      dbgEl = document.createElement('div');
      dbgEl.style.cssText = 'position:fixed;top:0;left:0;right:0;max-height:40vh;' +
        'overflow-y:auto;background:rgba(0,0,0,.85);color:#0f0;font:10px/1.5 monospace;' +
        'padding:6px 8px;z-index:99999;pointer-events:none;white-space:pre-wrap;';
      document.body.appendChild(dbgEl);
    }
    var line = '+' + String(Date.now() - t0).padStart(6, ' ') + 'ms  ' + msg;
    dbgEl.textContent += line + '\n';
    dbgEl.scrollTop = dbgEl.scrollHeight;
    console.log('[DTDBG]', line);
  }
  function describe(el) {
    if (!el || !el.tagName) return '?';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string')
      s += '.' + el.className.split(' ').slice(0, 2).join('.');
    return s;
  }
  if (DEBUG) {
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach(function (t) {
      document.addEventListener(t, function (e) {
        dlog(t + ' on ' + describe(e.target));
      }, true);
    });
  }

  /* ── Guard + watchdog state ── */
  var guardUntil = 0;
  var pendingLi = null;
  var retried = false;

  /* Block late synthesized clicks that land in the freshly opened
     drawer (close button, CTA, favorite) or on the overlay. */
  document.addEventListener('click', function (e) {
    if (Date.now() < guardUntil && e.target.closest &&
        e.target.closest('#dt-drawer, #dt-drawer-overlay')) {
      dlog('GUARD blocked click on ' + describe(e.target));
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  function drawerIsActive() {
    var d = document.getElementById('dt-drawer');
    return !!(d && d.classList.contains('is-active'));
  }

  function watchdog(stage) {
    if (!pendingLi) return;
    if (drawerIsActive()) {
      dlog('watchdog ' + stage + ': drawer active, ok');
      if (stage === 2) pendingLi = null;
      return;
    }
    dlog('watchdog ' + stage + ': drawer NOT active');
    if (!retried) {
      retried = true;
      dlog('watchdog: retrying list item click');
      guardUntil = Date.now() + 700;
      pendingLi.click();
    } else if (stage === 2) {
      pendingLi = null;
    }
  }

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

    /* Log drawer open/close transitions */
    if (DEBUG) {
      var d = document.getElementById('dt-drawer');
      if (d) {
        var was = d.classList.contains('is-active');
        new MutationObserver(function () {
          var is = d.classList.contains('is-active');
          if (is !== was) { dlog('DRAWER ' + (is ? 'OPEN' : 'CLOSE')); was = is; }
        }).observe(d, { attributes: true, attributeFilter: ['class'] });
      }
    }

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
        dlog('pin tap: ' + sc + ' -> opening');
        guardUntil = Date.now() + 700;
        pendingLi = li;
        retried = false;
        setTimeout(function () { li.click(); }, 60);
        setTimeout(function () { watchdog(1); }, 460);
        setTimeout(function () { watchdog(2); }, 900);
      }
    }, true);

    /* Hide tooltips and popups on touch devices. */
    var s = document.createElement('style');
    s.id = 'dt-mobile-tap-fix-styles';
    s.textContent = '@media (hover:none) and (pointer:coarse){' +
      '.cru-ncf-tooltip,.ncf-tooltip-pop-up-wrapper,' +
      '.ncf-tooltip-popup-inner-wrapper,.cru-ncf-pop-up' +
      '{display:none!important;}}';
    document.head.appendChild(s);

    console.log('[DT] Mobile pin tap fix v1.2.0 active' + (DEBUG ? ' (debug)' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
