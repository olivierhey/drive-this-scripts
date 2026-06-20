/**
 * Drive This – Mobile Pin Tap Fix
 * Version: 1.4.3 (2026-06-20)
 *
 * Touch only (desktop tap logic untouched). The active pin keeps its
 * native Mapbox popup after the drawer closes. Dismissal: tap another
 * pin or tap empty map. Panning keeps the popup (it follows the pin).
 *
 * Changes from 1.4.2:
 *  - Pin-to-pin switch fixed. NCF ignores a pin tap while another pin
 *    is selected (only an empty-map tap deselects), so simply removing
 *    the old pin's .active class was cosmetic: NCF still held the old
 *    selection, its popup lingered, and the inline drawer's tooltip
 *    scan reopened the OLD event for a moment. We now do a real
 *    background-tap deselect first (the only thing NCF treats as a
 *    deselect), then open the new one. This is the 1.4.0 behaviour
 *    WITHOUT the staggered clearActivePins that used to strip .active
 *    from the freshly selected pin (that was the actual flicker).
 *
 * 1.4.2: popup persists on pan; white active-pin highlight.
 * 1.4.1: switch flicker attempt (over-removed the deselect).
 * 1.4.0: popup un-hidden on touch, persist after drawer close.
 * 1.3.0: auto-deselect on close. 1.2.0: guard + watchdog + debug.
 */
(function () {

  /* -- Debug panel (only with ?dtdebug=1) -- */
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
    ['pointerdown', 'pointerup', 'click'].forEach(function (t) {
      document.addEventListener(t, function (e) {
        dlog(t + (e.isTrusted ? '' : ' (synthetic)') + ' on ' + describe(e.target));
      }, true);
    });
  }

  /* -- Guard + watchdog (drawer-open reliability) -- */
  var guardUntil = 0, pendingLi = null, retried = false, deselecting = false;

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
      if (stage === 2) pendingLi = null;
      return;
    }
    if (!retried) {
      retried = true;
      dlog('watchdog: retrying list item click');
      guardUntil = Date.now() + 700;
      pendingLi.click();
    } else if (stage === 2) {
      pendingLi = null;
    }
  }

  /* -- Real NCF deselect: a synthetic tap on an empty patch of map.
        Class removal alone does NOT reset NCF's internal selection,
        so this is required before selecting a different pin. -- */
  function dispatchTap(el, cx, cy) {
    var common = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown',
        Object.assign({ pointerId: 999, pointerType: 'mouse', isPrimary: true }, common)));
      el.dispatchEvent(new PointerEvent('pointerup',
        Object.assign({ pointerId: 999, pointerType: 'mouse', isPrimary: true }, common)));
    } catch (err) { /* PointerEvent not constructible - ignore */ }
    el.dispatchEvent(new MouseEvent('mousedown', common));
    el.dispatchEvent(new MouseEvent('mouseup', common));
    el.dispatchEvent(new MouseEvent('click', common));
  }

  function deselect() {
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

  function slugify(n) {
    return n.toLowerCase()
      .replace(/[\u00e4\u00c4]/g, 'ae').replace(/[\u00f6\u00d6]/g, 'oe').replace(/[\u00fc\u00dc]/g, 'ue')
      .replace(/[\u00df]/g, 'ss').replace(/[\u00e9\u00e8\u00ea\u00eb]/g, 'e').replace(/[\u00e0\u00e2]/g, 'a')
      .replace(/[\u00f9\u00fb]/g, 'u').replace(/[\u00ee\u00ef\u00ec]/g, 'i').replace(/[\u00f4\u00f2]/g, 'o')
      .replace(/[\u00f1]/g, 'n').replace(/[\u00e7]/g, 'c')
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

  function openLi(li, delay) {
    guardUntil = Date.now() + 700;
    pendingLi = li;
    retried = false;
    setTimeout(function () { li.click(); }, delay);
    setTimeout(function () { watchdog(1); }, delay + 400);
    setTimeout(function () { watchdog(2); }, delay + 840);
  }

  /* -- Active-pin highlight: white versions of the three pin SVGs.
        Mirrors pin-colors.js / featured-pins.js shapes, recoloured to
        white; .active-only overrides, the colour scripts are untouched. -- */
  function uri(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  var W = '#ffffff';
  var SVG_NORMAL =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="10" cy="10" r="8" fill="#2a2a3a" stroke="' + W + '" stroke-width="3"/></svg>';
  var SVG_FEATURED =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="12" cy="12" r="11" fill="' + W + '"/></svg>';
  var SVG_PAST =
    '<svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<g clip-path="url(#c2)"><path d="M14.5 8.5C14.5 5.18629 11.8137 2.5 8.5 2.5C5.18629 2.5 2.5 5.18629 2.5 8.5C2.5 11.8137 5.18629 14.5 8.5 14.5V17C3.80558 17 0 13.1944 0 8.5C0 3.80558 3.80558 0 8.5 0C13.1944 0 17 3.80558 17 8.5C17 13.1944 13.1944 17 8.5 17V14.5C11.8137 14.5 14.5 11.8137 14.5 8.5Z" fill="' + W + '"/>' +
    '<path d="M6.41504 5.3916C7.65506 5.3916 8.48219 6.0624 8.48242 7.06836C8.48242 7.65336 8.22494 8.07497 7.81934 8.54297L6.82129 9.68164H8.51367V11H4.27832V10.2822L6.40723 7.84082C6.60223 7.62242 6.69629 7.4118 6.69629 7.2168C6.69621 6.99081 6.54806 6.84292 6.27539 6.84277C6.01799 6.84277 5.85337 6.99067 5.75977 7.26367H4.2002C4.36401 6.06265 5.13609 5.39173 6.41504 5.3916ZM13.1562 6.39844L10.957 11H9.10059L11.0977 6.94434H8.83496V5.54004H13.1562V6.39844Z" fill="' + W + '"/></g>' +
    '<defs><clipPath id="c2"><rect width="17" height="17" fill="white"/></clipPath></defs></svg>';

  function injectStyles() {
    var s = document.createElement('style');
    s.id = 'dt-mobile-tap-fix-styles';
    s.textContent = [
      '@media (hover:none) and (pointer:coarse){',
      '.cru-ncf-tooltip,.ncf-tooltip-pop-up-wrapper,.ncf-tooltip-popup-inner-wrapper',
      '{display:none!important;}}',
      '.cru-ncf-pin.active[ncf-pinstyle="default"]:not(.is-favorite-pin):not(.is-past-event):not([data-dt-styled])',
      '{background-image:' + uri(SVG_NORMAL) + '!important;}',
      '.cru-ncf-pin.active[ncf-pinstyle="default"]:not(.is-favorite-pin):not(.is-past-event)[data-dt-styled]',
      '{background-image:' + uri(SVG_FEATURED) + '!important;}',
      '.cru-ncf-pin.active.is-past-event:not(.is-favorite-pin):not(.dt-filtered-out)',
      '{background-image:' + uri(SVG_PAST) + '!important;opacity:1!important;}'
    ].join('\n');
    document.head.appendChild(s);
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
      if (Math.sqrt(dx * dx + dy * dy) > 14) return; /* pan -> popup stays, no open */

      var pin = e.target.closest('.cru-ncf-pin');
      if (!pin) return; /* empty map -> NCF deselects natively */

      var sc = null, cl = pin.classList;
      for (var i = 0; i < cl.length; i++) {
        if (cl[i].indexOf('ncf-slug-') === 0) { sc = cl[i]; break; }
      }
      if (!sc) return;
      var slug = sc.replace('ncf-slug-', '');

      var li = findItem(slug);
      if (!li) return;

      /* If a DIFFERENT pin is selected, NCF ignores this tap. Force a
         real deselect first, then open the new one once NCF is clean. */
      var prevPin = document.querySelector('.cru-ncf-pin.active');
      if (prevPin && !prevPin.classList.contains(sc)) {
        dlog('pin tap: switching -> ' + slug);
        prevPin.classList.remove('active'); /* instant visual shrink */
        deselect();                          /* real NCF reset */
        openLi(li, 110);                     /* open after NCF settles */
      } else {
        dlog('pin tap: ' + slug + ' -> opening');
        openLi(li, 60);
      }
    }, true);

    injectStyles();
    console.log('[DT] Mobile pin tap fix v1.4.3 active' + (DEBUG ? ' (debug)' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
