/* Drive This · map-card-filter.js v1.6.0
   Filters the Car Event Map by Car Card: /car-event-map?card=DT-0009&name=Ferrari%20F40
   Reads data-dt-card-ids on .cru-ncf-map-list-item, hides non-matching list items and pins,
   shows a chip with a reset. No dependencies.
   v1.5.0: load this file on event pages too. There it remembers the exact image URL of every
   card linking to the map (localStorage), so the chip on the map shows the same, already cached
   image as a tilted mini card. No image remembered (e.g. a shared link): chip without card.
   v1.5.1: close icon as SVG so the x sits exactly centred in its circle.
   v1.6.0: cards on event pages open the card in /cards (?card=DT-…) instead of the map filter;
   the card's "On the map" button leads on to the filter. The image is still remembered first.
   The chip's mini card and name link back to the card. Coming from /cards with &art=<folder>,
   the chip builds the mini card from the Cards image store when nothing is remembered. */
(function () {
  'use strict';

  var THUMBS_KEY = 'dt_card_thumbs';
  var THUMBS_MAX = 60;
  var THUMB_HOST = /(^|\.)(website-files\.com|webflow\.com)$|^pub-6b1b7a25ccd0457d8a61cfbd67cab772\.r2\.dev$/;
  var CARDS_ASSETS = 'https://pub-6b1b7a25ccd0457d8a61cfbd67cab772.r2.dev/cards/';

  // The card itself, in the Cards app.
  function cardUrl(id) {
    return '/cards?card=' + encodeURIComponent(id);
  }

  function readThumbs() {
    try { return JSON.parse(localStorage.getItem(THUMBS_KEY)) || {}; } catch (e) { return {}; }
  }

  function safeThumb(url) {
    try {
      var u = new URL(url, window.location.href);
      return u.protocol === 'https:' && THUMB_HOST.test(u.hostname) ? u.href : '';
    } catch (e) { return ''; }
  }

  // --- event pages: remember card images ------------------------------------
  function rememberThumbs() {
    var links = document.querySelectorAll('a[href*="car-event-map"][href*="card="]');
    if (!links.length) return;

    function store(id, img) {
      var src = safeThumb(img.currentSrc || img.src);
      if (!src) return;
      var all = readThumbs();
      delete all[id];
      all[id] = src;                         // newest last
      var keys = Object.keys(all);
      while (keys.length > THUMBS_MAX) delete all[keys.shift()];
      try { localStorage.setItem(THUMBS_KEY, JSON.stringify(all)); } catch (e) {}
    }

    links.forEach(function (a) {
      var id;
      try { id = (new URL(a.href).searchParams.get('card') || '').trim().toUpperCase(); } catch (e) { return; }
      if (!id) return;
      // The card opens in /cards; its "On the map" button leads on to the filter.
      a.href = cardUrl(id);
      var img = a.querySelector('img');
      if (!img) return;
      if (img.complete && img.naturalWidth) store(id, img);
      else img.addEventListener('load', function () { store(id, img); }, { once: true });
      a.addEventListener('pointerdown', function () { if (img.naturalWidth) store(id, img); });
    });
  }

  var params = new URLSearchParams(window.location.search);
  var cardId = (params.get('card') || '').trim().toUpperCase();
  if (!cardId) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rememberThumbs);
    else rememberThumbs();
    return;
  }
  var cardThumb = safeThumb(readThumbs()[cardId] || '');
  var artFolder = (params.get('art') || '').trim().toLowerCase();
  if (!cardThumb && /^[a-z0-9-]{1,80}$/.test(artFolder)) {
    cardThumb = CARDS_ASSETS + artFolder + '/card-thumb.webp';
  }

  var cardName = (params.get('name') || '').trim();
  var ITEM = '.cru-ncf-map-list-item';
  var PIN = '.cru-ncf-pin';
  var HIDE = 'dt-card-hidden';
  var allowedNames = new Set();
  var allowedSlugs = new Set();
  var matchCount = 0;
  var chip = null;

  // --- styles -------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent =
    '.' + HIDE + '{display:none!important}' +
    '.dt-card-chip{position:fixed;left:50%;top:100px;transform:translateX(-50%);z-index:9000;' +
    'display:flex;align-items:center;gap:10px;padding:8px 10px 8px 20px;background:#fff;color:#000;' +
    'border:1px solid rgba(255,255,255,.25);border-radius:999px;font:600 12px/1 system-ui,-apple-system,sans-serif;' +
    'letter-spacing:.06em;text-transform:uppercase;box-shadow:0 6px 20px rgba(0,0,0,.35)}' +
    '.dt-card-chip strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.dt-card-chip a{color:inherit;text-decoration:none}' +
    '.dt-card-chip a.dt-card-chip__name{min-width:0;display:flex}' +
    '.dt-card-chip a.dt-card-chip__name:hover strong{text-decoration:underline;text-underline-offset:3px}' +
    '.dt-card-chip .dt-card-chip__count{opacity:.7;font-weight:400;white-space:nowrap}' +
    '.dt-card-chip .dt-card-chip__id{font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0;' +
    'text-transform:none;opacity:.7;padding:4px 7px;border:1px solid rgba(0,0,0,.18);border-radius:6px;white-space:nowrap}' +
    '.dt-card-chip button{all:unset;cursor:pointer;width:28px;height:28px;flex:none;display:grid;place-items:center;' +
    'border-radius:50%;background:rgba(0,0,0,.12);font-size:16px;line-height:1}' +
    '.dt-card-chip button svg{display:block}' +
    '.dt-card-chip button:hover{background:rgba(0,0,0,.25)}' +
    /* mini card, sticking out of the chip */
    '.dt-card-chip--thumb{padding-left:66px}' +
    '.dt-card-chip__card{position:absolute;left:12px;top:-13px;width:40px;height:50px;border-radius:4px;overflow:hidden;' +
    'background:#f4e4cf;transform:rotate(-6deg);box-shadow:1px 3px 6px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.08);' +
    'transition:transform .22s cubic-bezier(.3,1.4,.5,1),box-shadow .22s;animation:dtCardDrop .5s cubic-bezier(.3,1.4,.5,1) both}' +
    '.dt-card-chip__card img{display:block;width:100%;height:100%;object-fit:cover}' +
    '.dt-card-chip:hover .dt-card-chip__card{transform:rotate(0deg) scale(1.18) translateY(-3px);box-shadow:0 10px 22px rgba(0,0,0,.45)}' +
    '@keyframes dtCardDrop{from{opacity:0;transform:translateY(-28px) rotate(-18deg)}to{opacity:1;transform:rotate(-6deg)}}' +
    '@media(prefers-reduced-motion:reduce){.dt-card-chip__card{animation:none;transition:none}}' +
    '@media(max-width:767px){.dt-card-chip{top:auto;bottom:16px;max-width:calc(100% - 32px);white-space:nowrap}' +
    '.dt-card-chip .dt-card-chip__id{display:none}}';
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

  var rafPending = false;
  function schedule() {
    // re-apply before the next paint, so a re-rendered list never shows unfiltered
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; apply(); });
  }

  // --- chip ---------------------------------------------------------------
  function renderChip() {
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'dt-card-chip';
      chip.setAttribute('role', 'status');
      chip.innerHTML = '<a class="dt-card-chip__name"><strong></strong></a><span class="dt-card-chip__count"></span>' +
        '<span class="dt-card-chip__id"></span><button type="button" aria-label="Show all events"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' +
        '<path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
      chip.querySelector('.dt-card-chip__id').textContent = cardId;
      chip.querySelector('.dt-card-chip__name').href = cardUrl(cardId);
      if (cardThumb) {
        var card = document.createElement('a');
        card.className = 'dt-card-chip__card';
        card.href = cardUrl(cardId);
        card.setAttribute('aria-label', 'Open the card');
        var img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('error', function () {      // image gone: fall back to the plain chip
          card.remove();
          chip.classList.remove('dt-card-chip--thumb');
        });
        img.src = cardThumb;                             // same URL as on the event page: served from cache
        card.appendChild(img);
        chip.insertBefore(card, chip.firstChild);
        chip.classList.add('dt-card-chip--thumb');
      }
      chip.querySelector('button').addEventListener('click', function () {
        window.location.href = window.location.pathname;
      });
      document.body.appendChild(chip);
    }
    chip.querySelector('strong').textContent = cardName || cardId;
    chip.querySelector('.dt-card-chip__count').textContent = matchCount === 1 ? '1 event' : matchCount + ' events';
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
