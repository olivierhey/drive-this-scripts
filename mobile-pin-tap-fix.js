/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.3.0 (2026-06-12)
 *
 * Changes from 1.2.0:
 *  - Auto-deselect on drawer close (touch only): NCF keeps the pin
 *    in its internal "selected" state after the drawer closes, so it
 *    consumes the next tap to deselect instead of selecting the new
 *    pin. When the drawer closes, we now simulate a tap on the map
 *    background (a point with no pin under it), which is exactly the
 *    manual workaround that resets NCF. Fallback: if a pin still has
 *    the "active" class shortly after, the class is removed so the
 *    pin at least shrinks back visually.
 *
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

  /* ── Guard + watchdog state ── */
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

  /* ── Auto-deselect: simulate a background tap on the map ── */
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
      dlog('auto-deselect: background tap at ' + Math.round(cx) + ',' + Math.round(cy));
      deselecting = true;
      dispatchTap(el, cx, cy);
      setTimeout(function () { deselecting = false; }, 150);
      return true;
    }
    dlog('auto-deselect: no free background spot found');
    return false;
  }

  function clearActivePins() {
    var stale = document.querySelectorAll('.cru-ncf-pin.active');
    if (stale.length) {
      dlog('auto-deselect fallback: removing active class from ' + stale.length + ' pin(s)');
      stale.forEach(function (p) { p.classList.remove('active'); });
    }
  }

  function setupAutoDeselect() {
    if (!IS_TOUCH) return;
    var d = document.getElementById('dt-drawer');
    if (!d) { setTimeout(setupAutoDeselect, 500); return; }
    var was = d.classList.contains('is-active');
    new MutationObserver(function () {
      var is = d.classList.contains('is-active');
      if (is !== was) {
        dlog('DRAWER ' + (is ? 'OPEN' : 'CLOSE'));
        if (!is) {
          setTimeout(backgroundTap, 120);
          /* Staggered fallback – NCF's recenter animation can
             re-apply .active after the background tap. */
          [350, 550, 800].forEach(function (ms) {
            setTimeout(clearActivePins, ms);
          });
        }
        was = is;
      }
    }).observe(d, { attributes: true, attributeFilter: ['class'] });
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

    setupAutoDeselect();

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

    console.log('[DT] Mobile pin tap fix v1.3.0 active' + (DEBUG ? ' (debug)' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
