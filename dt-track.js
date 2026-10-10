/**
 * Drive This – Plausible tracking for user journeys
 * Version: 1.0.0 (2026-10-11)
 *
 * Sends two custom events without touching existing scripts:
 *  - "Event Open"  when the map drawer opens or switches to another event
 *                  props: slug, name
 *  - "Event Save"  when an event is saved (not when it is removed)
 *                  props: slug, source (drawer | map_list | event_page)
 *
 * Already tracked elsewhere (no change needed):
 *  - calendar_saved_download / calendar_single_download  (calendar-export.js)
 *  - Card Map Filter                                     (map-card-filter.js)
 *
 * Load on the map page and the event template, after the Plausible snippet.
 */
(function () {
  'use strict';

  function track(name, props) {
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props: props });
    } catch (e) { /* analytics must never break the page */ }
  }

  /* ── Event Save ── */
  window.addEventListener('dt:favorite-toggled', function (e) {
    var d = (e && e.detail) || {};
    if (!d.isFavorited || !d.slug) return;
    var source = document.body.classList.contains('dt-drawer-open') ? 'drawer'
      : document.getElementById('dt-drawer') ? 'map_list'
      : 'event_page';
    track('Event Save', { slug: d.slug, source: source });
  });

  /* ── Event Open (map drawer) ── */
  function initDrawer(attempt) {
    var drawer = document.getElementById('dt-drawer');
    if (!drawer) {
      if (attempt < 25) setTimeout(function () { initDrawer(attempt + 1); }, 400);
      return;
    }
    var title = document.getElementById('dt-drawer-title');
    var lastKey = '';

    function check() {
      if (!drawer.classList.contains('is-active')) { lastKey = ''; return; }
      var slug = new URLSearchParams(window.location.search).get('event') || '';
      var name = title ? title.textContent.trim() : '';
      var key = slug || name;
      if (!key || key === lastKey) return;
      lastKey = key;
      track('Event Open', { slug: slug || '(unknown)', name: name || '(unknown)' });
    }

    var mo = new MutationObserver(function () { setTimeout(check, 0); });
    mo.observe(drawer, { attributes: true, attributeFilter: ['class'] });
    if (title) mo.observe(title, { childList: true, characterData: true, subtree: true });
    check();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initDrawer(0); });
  } else {
    initDrawer(0);
  }
})();
