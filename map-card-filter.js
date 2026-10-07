/* Drive This · map-card-filter.js v1.2.0
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
  var PIN = '.cru-ncf-pin, .mapboxgl-marker';
  var HIDE = 'dt-card-hidden';
  var allowedNames = new Set();
  var matchCount = 0;
  var chip = null;
  var timer = null;

  // --- styles -------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent =
    '.' + HIDE + '{display:none!important}' +
    '.dt-card-chip{position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:9000;' +
    'display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;background:#141414;color:#fff;' +
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
    matchCount = 0;

    document.querySelectorAll(ITEM).forEach(function (item) {
      var hit = idsOf(item).indexOf(cardId) !== -1;
      item.classList.toggle(HIDE, !hit);
      if (hit) {
        matchCount++;
        var n = nameOf(item);
        if (n) allowedNames.add(n);
      }
    });

    var pins = document.querySelectorAll(PIN);
    var keep = [];
    pins.forEach(function (pin) {
      var n = pinName(pin);
      keep.push(!n || nameMatches(n));      // unnamed pin: leave it alone
    });
    var anyVisible = keep.some(Boolean);
    pins.forEach(function (pin, i) {
      // safety net: never hide every pin; if nothing matches, leave pins untouched
      pin.classList.toggle(HIDE, anyVisible ? !keep[i] : false);
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
        var hidden = pins.filter(function (p) { return p.classList.contains(HIDE); }).length;
        var items = document.querySelectorAll(ITEM).length;
        var lines = [
          '[DT card filter] card=' + cardId,
          'list items: ' + items + ', matching: ' + matchCount,
          'allowed names: ' + Array.from(allowedNames).join(' | '),
          'pins total: ' + pins.length + ', hidden by filter: ' + hidden
        ].concat(pins.slice(0, 6).map(function (p, i) {
          return 'pin ' + i + ': <' + p.tagName.toLowerCase() + ' class="' + p.className + '"> name="' + pinName(p) + '" html=' + (p.outerHTML || '').slice(0, 160).replace(/\s+/g, ' ');
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
