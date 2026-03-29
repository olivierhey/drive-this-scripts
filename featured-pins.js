/**
 * Drive This – Featured Event Pins
 * Version: 1.9.3
 *
 * Changes from 1.9.2:
 *  - Normal pins: 18px (up from 16px)
 *  - Featured pins: glow removed
 */
(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';

  /* ─── Helpers ─── */

  function makeFeaturedPinUri(color) {
    // r="10" fills the 22px element flush to the edge — no gap between circle and glow
    const svg = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" fill="${color}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function rgbToHex(rgb) {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  function extractColor(el) {
    const selectors = ['.bottom', '[class*="bottom"]', '[class*="footer"]', '[class*="color"]'];
    for (const sel of selectors) {
      const child = el.querySelector(sel);
      if (!child) continue;
      const hex = rgbToHex(getComputedStyle(child).backgroundColor);
      if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
    }
    for (const child of el.querySelectorAll('[style*="background"]')) {
      const hex = rgbToHex(getComputedStyle(child).backgroundColor);
      if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
    }
    return null;
  }

  function getFeaturedEvents() {
    const events = [];
    document.querySelectorAll('[data-featured="1"][data-slug]').forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug) return;
      // Fallback prevents silent drop when Webflow CSS isn't fully painted yet.
      // retryColorInjection() will patch real colors 2.5s later.
      const color = extractColor(el) || '#C8A84B';
      events.push({
        slug,
        color,
        name: el.dataset.name || el.querySelector('h3')?.textContent?.trim() || slug,
      });
    });
    return events;
  }

  /* ─── Map container helper ─── */

  function getMapContainer() {
    return document.querySelector('.mapboxgl-map') ||
           document.querySelector('.ncf-map-wrapper') ||
           document.querySelector('[class*="ncf-map"]');
  }

  /* ─── 1. Global CSS ─── */

  function injectGlobalCSS() {
    const existing = document.getElementById('dt-featured-global-css');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'dt-featured-global-css';
    style.textContent = [
      // Pointer cursor on all pins
      `.cru-ncf-pin { cursor: pointer !important; }`,
      // Normal pins 18px — visually subordinate to featured (22px)
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin) { width: 18px !important; height: 18px !important; }`,
      // Glow must not be clipped at any level of the marker stack
      `.mapboxgl-marker { overflow: visible !important; }`,
      `.cru-ncf-pin { overflow: visible !important; }`,
      // Kills NCF hover tooltip flicker: the NCF tooltip appears above the pin and
      // steals mouseleave, creating a flicker loop. pointer-events:none breaks it.
      `.mapboxgl-marker [class*="tooltip"] { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="ncf-tip"]  { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="popup"]    { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="label"]    { pointer-events: none !important; }`,
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── 2. Pin styles ─── */

  function injectPinStyles(events) {
    const existing = document.getElementById('dt-featured-pin-styles');
    if (existing) existing.remove();
    const rules = events.map(({ slug, color }) => {
      const uri = makeFeaturedPinUri(color);
      return [
        `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) {`,
        `  background-image: ${uri} !important;`,
        `  width: 22px !important;`,
        `  height: 22px !important;`,
        `  border-radius: 50% !important;`,
        `  overflow: visible !important;`,
        `}`,
      ].join('\n');
    });
    if (!rules.length) return;
    const style = document.createElement('style');
    style.id = 'dt-featured-pin-styles';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
    console.log(`[DT Featured] ${rules.length} pin style(s) injected.`);
  }

  /* ─── 3. Card stripes ─── */

  function applyCardStripes(events) {
    const colorMap = {};
    events.forEach(({ slug, color }) => { colorMap[slug] = color; });
    document.querySelectorAll('[data-featured="1"][data-slug]').forEach(card => {
      const slug = card.dataset.slug?.trim();
      const color = colorMap[slug] || extractColor(card);
      if (!color) return;
      const stripe = `inset 0 5px 0 0 ${color}`;
      const current = card.style.boxShadow || '';
      if (!current.includes('inset 0 5px')) {
        card.style.boxShadow = current ? `${current}, ${stripe}` : stripe;
      }
    });
  }

  /* ─── 4. z-index + overflow on .mapboxgl-marker parents ─── */

  function applyFeaturedMarkerStyles(events) {
    events.forEach(({ slug }) => {
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) return;
      const marker = pin.closest('.mapboxgl-marker');
      if (marker) {
        marker.style.zIndex = '100';
        marker.style.overflow = 'visible';
      }
    });
  }

  /* ─── 5. Retry color injection ─── */

  function retryColorInjection() {
    // Re-check colors 2.5s after init — by then Webflow CSS is fully applied
    // and any pins that got the fallback gold will be updated with real colors.
    setTimeout(() => {
      if (!window._dtFeaturedEvents?.length) return;
      const updated = [];
      document.querySelectorAll('[data-featured="1"][data-slug]').forEach(el => {
        const slug = el.dataset.slug?.trim();
        if (!slug) return;
        const color = extractColor(el);
        if (color && color !== '#C8A84B') updated.push({ slug, color });
      });
      if (!updated.length) return;
      window._dtFeaturedEvents = window._dtFeaturedEvents.map(ev => {
        const u = updated.find(e => e.slug === ev.slug);
        return u ? { ...ev, color: u.color } : ev;
      });
      injectPinStyles(window._dtFeaturedEvents);
      applyFeaturedMarkerStyles(window._dtFeaturedEvents);
      console.log('[DT Featured] Colors refreshed after retry.');
    }, 2500);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    injectGlobalCSS();
    injectPinStyles(events);
    applyCardStripes(events);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const mapEl = getMapContainer();
      // Wait until ALL featured pins are in the DOM, not just the first.
      // Previously only events[0] was checked — if it appeared before the others,
      // the interval cleared early and the remaining pins never got their styles.
      const allPinsPresent = events.every(({ slug }) =>
        document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`)
      );
      if (allPinsPresent && mapEl) {
        clearInterval(interval);
        applyFeaturedMarkerStyles(events);
        retryColorInjection();
        console.log('[DT Featured] Ready — all pins found.');
      } else if (attempts >= 40) {
        // Timeout: apply styles to whatever pins did load
        clearInterval(interval);
        const found = events.filter(({ slug }) =>
          document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`)
        );
        if (found.length) {
          applyFeaturedMarkerStyles(found);
          console.warn(`[DT Featured] Timeout — styled ${found.length}/${events.length} pins.`);
        } else {
          console.warn('[DT Featured] Map or pins not found.');
        }
      }
    }, 500);
  }

  function waitForData() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const events = getFeaturedEvents();
      if (events.length > 0) {
        clearInterval(interval);
        console.log(`[DT Featured] Found ${events.length} event(s):`, events.map(e => e.slug));
        init(events);
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[DT Featured] No featured events found.');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForData);
  } else {
    waitForData();
  }

})();
