/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.4.0 (2026-06-20)
 *
 * Goal of this version (touch only, desktop untouched):
 * Keep the selected pin + its native Mapbox popup visible AFTER the
 * drawer closes, so the user still sees which event they picked.
 * Dismiss the popup only on the next deliberate gesture: panning the
 * map, tapping another pin, or tapping empty map.
 *
 * Changes from 1.3.0:
 *  - Popup no longer hidden on touch: `.cru-ncf-pop-up` removed from
 *    the CSS hide list. Only the hover TOOLTIP stays hidden (no hover
 *    state on touch). The popup is a standard Mapbox GL popup
 *    (.mapboxgl-popup) pinned to the pin's coordinate, so it follows
 *    the pin and survives the recenter animation on its own.
 *  - Auto-deselect-on-close REMOVED. The pin keeps its .active state
 *    and NCF keeps the popup after the drawer closes.
 *  - Pan-to-dismiss ADDED: a touch drag (> 14px) deselects the active
 *    pin via the same background-tap that NCF treats as a real
 *    deselect, which also tears down the popup cleanly. NCF does NOT
 *    hide the popup on drag by itself, so we do it.
 *  - Switch-pin guard ADDED: tapping a different pin while one is
 *    active deselects the old one first, so the new pin opens in a
 *    single tap instead of the old "first tap only deselects" issue.
 *
 * v1.3.0: auto-deselect on close via background tap + clearActivePins.
 * v1.2.0: broad click guard (drawer + overlay, 700ms), watchdog
 *         retry, on-screen debug panel via ?dtdebug=1.
 * v1.1.0: overlay click guard, NCF popups hidden on touch.
 * v1.0.0: direct pin tap detection -> programmatic list item click.
 */
(function () {

  var IS_TOUCH = window.matchMedia &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

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
        dlog(t + (e.isTrusted ? '' : ' (synthetic)') + ' on ' + describe(e.target));
      }, true);
    });
  }

  /* ── Guard + watchdog state (drawer-open reliability) ── */
  var guardUntil = 0;
  var pendingLi = null;
  var retried = false;
  var deselecting = false;

  document.addEventListener('click', function (e) {
    if (Date.now() < guardUntil && e.isTrusted && e.target.closest &&
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

  /* ── Deselect: simulate a background tap NCF treats as a real
        deselect. This both shrinks the pin and tears down the
        Mapbox popup. Class removal alone does NOT reset NCF's
        internal selection, so the synthetic tap is required. ── */
  function dispatchTap(el, cx, cy) {
    var common = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown',
        Object.assign({ pointerId: 999, pointerType: 'mouse', isPrimary: true }, common)));
      el.dispatchEvent(new PointerEvent('pointerup',
        Object.assign({ pointerId: 999, pointerType: 'mouse', isPrimary: true }, common)));
    } catch (err) { /* PointerEvent not constructible – ignore */ }
    el.dispatchEvent(new MouseEvent('mousedown', common));
    el.dispatchEvent(new MouseEvent('mouseup', common));
    el.dispatchEvent(new MouseEvent('click', common));
  }

  function backgroundTap() {
    var canvas = document.querySelector('.mapboxgl-canvas');
    if (!canvas) return false;
    var r = canvas.getBoundingClientRect();
    if (r.width < 60 || r.height < 60) return false;
    var spots = [
      [r.width * 0.5, 16], [16, r.height * 0.5],
      [r.width - 16, r.height * 0.5], [r.width * 0.5, r.height - 16],
      [16, 16], [r.width - 16, 16]
    ];
    for (var i = 0; i < spots.length; i++) {
      var cx = r.left + spots[i][0], cy = r.top + spots[i][1];
      var el = document.elementFromPoint(cx, cy);
      if (!el) continue;
      if (el.closest('.cru-ncf-pin, .mapboxgl-marker')) continue; /* would select a pin */
      if (!el.closest('.mapboxgl-canvas-container, .mapboxgl-canvas, .mapboxgl-map')) continue;
      dlog('deselect: background tap at ' + Math.round(cx) + ',' + Math.round(cy));
      deselecting = true;
      dispatchTap(el, cx, cy);
      setTimeout(function () { deselecting = false; }, 150);
      return true;
    }
    dlog('deselect: no free background spot found');
    return false;
  }

  function clearActivePins() {
    var stale = document.querySelectorAll('.cru-ncf-pin.active');
    if (stale.length) {
      dlog('deselect fallback: removing active class from ' + stale.length + ' pin(s)');
      stale.forEach(function (p) { p.classList.remove('active'); });
    }
  }

  function deselect() {
    backgroundTap();
    /* Visual fallback if NCF re-applies .active during a recenter. */
    [120, 300, 500].forEach(function (ms) { setTimeout(clearActivePins, ms); });
  }

  function hasActivePin() {
    return !!document.querySelector('.cru-ncf-pin.active');
  }

  function activeSlug() {
    var p = document.querySelector('.cru-ncf-pin.active');
    if (!p) return null;
    var c = [].slice.call(p.classList).find(function (x) {
      return x.indexOf('ncf-slug-') === 0;
    });
    return c ? c.replace('ncf-slug-', '') : null;
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

  /* ── Open the drawer for a list item, with watchdog retries.
        `delay` lets a preceding deselect settle before we click. ── */
  function openLi(li, delay) {
    guardUntil = Date.now() + 700;
    pendingLi = li;
    retried = false;
    setTimeout(function () { li.click(); }, delay);
    setTimeout(function () { watchdog(1); }, delay + 400);
    setTimeout(function () { watchdog(2); }, delay + 840);
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
      if (multi || deselecting) return;

      var dx = e.clientX - x, dy = e.clientY - y;
      var moved = Math.sqrt(dx * dx + dy * dy);

      /* PAN (not a tap): dismiss the persistent popup, if any. */
      if (moved > 14) {
        if (!drawerIsActive() && hasActivePin()) {
          dlog('pan -> deselect');
          deselect();
        }
        return;
      }

      /* TAP on a pin. */
      var pin = e.target.closest('.cru-ncf-pin');
      if (!pin) return; /* tap on empty map -> NCF deselects natively */

      var sc = null, cl = pin.classList;
      for (var i = 0; i < cl.length; i++) {
        if (cl[i].indexOf('ncf-slug-') === 0) { sc = cl[i]; break; }
      }
      if (!sc) return;
      var slug = sc.replace('ncf-slug-', '');

      var li = findItem(slug);
      if (!li) return;

      /* Switching from a different active pin: deselect it first so
         NCF doesn't consume this tap just to deselect the old one. */
      var prev = activeSlug();
      if (prev && prev !== slug) {
        dlog('pin tap: switching ' + prev + ' -> ' + slug);
        deselect();
        openLi(li, 140);
      } else {
        dlog('pin tap: ' + slug + ' -> opening');
        openLi(li, 60);
      }
    }, true);

    /* Hide the hover TOOLTIP on touch (no hover state exists).
       The click POPUP (.cru-ncf-pop-up / .mapboxgl-popup) stays
       visible on purpose. */
    var s = document.createElement('style');
    s.id = 'dt-mobile-tap-fix-styles';
    s.textContent = '@media (hover:none) and (pointer:coarse){' +
      '.cru-ncf-tooltip,.ncf-tooltip-pop-up-wrapper,' +
      '.ncf-tooltip-popup-inner-wrapper' +
      '{display:none!important;}}';
    document.head.appendChild(s);

    console.log('[DT] Mobile pin tap fix v1.4.0 active' + (DEBUG ? ' (debug)' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
