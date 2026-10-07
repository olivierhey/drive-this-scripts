/* Drive This · map-card-filter.js v1.3.0
   Filters the Car Event Map by Car Card: /car-event-map?card=DT-0009&name=Ferrari%20F40
   Reads data-dt-card-ids on .cru-ncf-map-list-item, hides non-matching list items and pins,
   shows a chip with a reset. No dependencies. */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var cardId = (params.get('card') || '').trim().toUpperCase();
  if (!cardId) return;

  var cardName = (params.get('name') || '').trim();
  var ITEM = '.cru-ncf-map-list-item';
  var PIN = '.cru-ncf-pin';
  var HIDE = 'dt-card-hidden';
  var allowedNames = new Set();
  var allowedSlugs = new Set();
  var matchCount = 0;
  var chip = null;
  var timer = null;

  // --- styles -------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent =
    '.' + HIDE + '{display:none!important}' +
    '.dt-card-chip{position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:9000;' +
    'display:flex;align-items:center;gap:10px;padding:8px 10px 8px 20px;background:#fff;color:#000;' +
    'border:1px solid rgba(255,255,255,.25);border-radius:999px;font:600 12px/1 system-ui,-apple-system,sans-serif;' +
    'letter-spacing:.06em;text-transform:uppercase;box-shadow:0 6px 20px rgba(0,0,0,.35)}' +
    '.dt-card-chip span{opacity:.7;font-weight:400}' +
    '.dt-card-chip button{all:unset;cursor:pointer;width:28px;height:28px;display:grid;place-items:center;' +
    'border-radius:50%;background:rgba(255,255,255,.12);font-size:14px;line-height:1}' +
    '.dt-card-chip button:hover{background:rgba(255,255,255,.25)}' +
    '@media(max-width:767px){.dt-card-chip{top:auto;bottom:16px;max-width:calc(100% - 32px);white-space:nowrap;overflow:hidden}}';
  document.head.appendChild(style);

  // --- helpers ------------------------------------------------------------
  function idsOf(el) {
    var raw = el.dataset.dtCardIds;
    if (raw === undefined) {
      var inner = el.querySelector('[data-dt-card-ids]');
      raw = inner ? inner.dataset.dtCardIds : '';
    }
    return (raw || '').toUpperCase().split(/[,\s]+/).filter(Boolean);
  }

  function norm(s) {
    return (s || '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/\s+/g, ' ').trim();
  }

  function nameOf(el) {
    return norm(el.dataset.name || (el.querySelector('h3') || {}).textContent || '');
  }

  function slugify(n) {
    return (n || '').toLowerCase().replace(/[\u00e4]/g, 'ae').replace(/[\u00f6]/g, 'oe').replace(/[\u00fc]/g, 'ue')
      .replace(/\u00df/g, 'ss').replace(/[\u00e9\u00e8\u00ea\u00eb]/g, 'e').replace(/[\u00e0\u00e2]/g, 'a')
      .replace(/[\u00f9\u00fb]/g, 'u').replace(/[\u00ee\u00ef\u00ec]/g, 'i').replace(/[\u00f4\u00f2]/g, 'o')
      .replace(/\u00f1/g, 'n').replace(/\u00e7/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function slugOf(item) {
    return item.dataset.slug || slugify(item.dataset.name || (item.querySelector('h3') || {}).textContent || '');
  }

  function pinSlug(pin) {
    var m = (pin.className || '').match(/ncf-slug-([^\s]+)/);
    return m ? m[1] : '';
  }

  function pinName(pin) {
    return norm(pin.dataset.name || pin.getAttribute('aria-label') || pin.getAttribute('title') || pin.textContent || '');
  }

  function nameMatches(n) {
    if (allowedNames.has(n)) return true;
    var hit = false;
    allowedNames.forEach(function (a) {
      if (!hit && a.length > 3 && n.length > 3 && (n.indexOf(a) !== -1 || a.indexOf(n) !== -1)) hit = true;
    });
    return hit;
  }

  // --- filter -------------------------------------------------------------
  function apply() {
    allowedNames = new Set();
    allowedSlugs = new Set();
    matchCount = 0;

    document.querySelectorAll(ITEM).forEach(function (item) {
      var hit = idsOf(item).indexOf(cardId) !== -1;
      item.classList.toggle(HIDE, !hit);
      if (hit) {
        matchCount++;
        var n = nameOf(item);
        if (n) allowedNames.add(n);
        var sl = slugOf(item);
        if (sl) allowedSlugs.add(sl);
      }
    });

    var pins = document.querySelectorAll(PIN);
    var markers = [];
    var keep = [];
    pins.forEach(function (pin) {
      var sl = pinSlug(pin);
      if (!sl) return;                      // pin without slug: leave it alone
      markers.push(pin.closest('.mapboxgl-marker') || pin);
      keep.push(allowedSlugs.has(sl) || nameMatches(pinName(pin)));
    });
    var anyVisible = keep.some(Boolean);
    markers.forEach(function (marker, i) {
      // safety net: never hide every pin; if nothing matches, leave pins untouched
      marker.classList.toggle(HIDE, anyVisible ? !keep[i] : false);
    });

    renderChip();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 300);
  }

  // --- chip ---------------------------------------------------------------
  function renderChip() {
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'dt-card-chip';
      chip.setAttribute('role', 'status');
      chip.innerHTML = '<strong></strong><span></span><button type="button" aria-label="Show all events">✕</button>';
      chip.querySelector('button').addEventListener('click', function () {
        window.location.href = window.location.pathname;
      });
      document.body.appendChild(chip);
    }
    chip.querySelector('strong').textContent = cardName || cardId;
    chip.querySelector('span').textContent = matchCount === 1 ? '1 event' : matchCount + ' events';
  }

  // --- boot: NCF loads items late, so watch for them -----------------------
  function boot() {
    apply();
    var observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes.length) { schedule(); return; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // belt and braces for the first seconds
    var tries = 0;
    var iv = setInterval(function () {
      apply();
      if (++tries >= 20) clearInterval(iv);
    }, 250);

    if (params.get('dtdebug')) {
      setTimeout(function () {
        var pins = Array.prototype.slice.call(document.querySelectorAll(PIN));
        var hidden = pins.filter(function (p) { return (p.closest('.mapboxgl-marker') || p).classList.contains(HIDE); }).length;
        var items = document.querySelectorAll(ITEM).length;
        var lines = [
          '[DT card filter] card=' + cardId,
          'list items: ' + items + ', matching: ' + matchCount,
          'allowed names: ' + Array.from(allowedNames).join(' | '),
          'allowed slugs: ' + Array.from(allowedSlugs).join(' | '),
          'pins total: ' + pins.length + ', hidden by filter: ' + hidden
        ].concat(pins.slice(0, 4).map(function (p, i) {
          return 'pin ' + i + ': slug=' + pinSlug(p) + ' hidden=' + (p.closest('.mapboxgl-marker') || p).classList.contains(HIDE);
        }));
        console.log(lines.join('\n'));
      }, 3000);
    }

    if (typeof window.plausible === 'function') {
      window.plausible('Card Map Filter', { props: { card: cardId, name: cardName || '' } });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.DTCardFilter = { card: cardId, apply: apply };
})();
