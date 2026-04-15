/**
 * Drive This – Featured Event Pins
 * Version: 2.0.2
 *
 * Changes from 2.0.1:
 *  - ::before bridge removed
 *
 * Changes from 2.0.0:
 *  - Hover scale removed: pins no longer grow on hover, only on click (.active state)
 *    Eliminates the cursor/tooltip flicker loop caused by hover-triggered size changes
 *
 * Changes from 1.9.3:
 *  - Featured pins: 24px (up from 22px)
 *  - Active pin state: normal pins 22px, featured pins 28px when popup open
 *  - Race condition fix: MutationObserver applies styles per-pin as they appear
 *    instead of waiting for ALL pins simultaneously (was blocking on off-screen pins)
 *  - Staggered retry syncs ensure pins styled even after map pan/zoom
 */
(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  let featuredSlugs = new Set();

  /* ─── Helpers ─── */

  function makeFeaturedPinUri(color) {
    const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="${color}"/></svg>`;
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
      const color = extractColor(el) || '#C8A84B';
      events.push({
        slug,
        color,
        name: el.dataset.name || el.querySelector('h3')?.textContent?.trim() || slug,
      });
    });
    return events;
  }

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
      // Cursor
      `.cru-ncf-pin { cursor: pointer !important; }`,
      // Normal pins 18px
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin) { width: 18px !important; height: 18px !important; }`,
      // Active state: normal pins grow to 22px when popup open
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin).active { width: 22px !important; height: 22px !important; }`,
      // Overflow must be visible for z-index and glow effects
      `.mapboxgl-marker { overflow: visible !important; }`,
      `.cru-ncf-pin { overflow: visible !important; }`,
      // HOVER FIX: No size or transform change on hover – active (.active) only.
      // NCF may inject its own :hover scale; neutralise it explicitly.
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin):hover {`,
      `  transform: none !important;`,
      `  width: 18px !important;`,
      `  height: 18px !important;`,
      `}`,
      // Same for featured pins (slug-specific styles set 24px base)
      `.mapboxgl-marker:hover .cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin) {`,
      `  transform: none !important;`,
      `}`,
      // Tooltip pointer-events off to prevent them stealing hover
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
        // Base: 24px solid fill
        `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) {`,
        `  background-image: ${uri} !important;`,
        `  width: 24px !important;`,
        `  height: 24px !important;`,
        `  border-radius: 50% !important;`,
        `  overflow: visible !important;`,
        `}`,
        // Active state: grow to 28px when popup open
        `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin).active {`,
        `  width: 28px !important;`,
        `  height: 28px !important;`,
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

  /* ─── 4. Apply marker styles to a single pin ─── */

  function styleMarker(pin) {
    pin.style.position = 'relative';
    const marker = pin.closest('.mapboxgl-marker');
    if (marker) {
      marker.style.zIndex = '100';
      marker.style.overflow = 'visible';
    }
  }

  /* ─── 5. Sweep: style all featured pins currently in DOM ─── */

  function sweepAndStyle() {
    let count = 0;
    featuredSlugs.forEach(slug => {
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (pin) { styleMarker(pin); count++; }
    });
    return count;
  }

  /* ─── 6. MutationObserver: style pins the moment they appear ─── */

  function setupPinObserver(events) {
    const mapEl = getMapContainer();
    if (!mapEl) return;

    const observer = new MutationObserver(() => {
      events.forEach(({ slug }) => {
        const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
        if (pin && !pin.dataset.dtStyled) {
          pin.dataset.dtStyled = '1';
          styleMarker(pin);
          console.log(`[DT Featured] Styled pin: ${slug}`);
        }
      });
    });

    observer.observe(mapEl, { childList: true, subtree: true });

    sweepAndStyle();
    [500, 1500, 3000, 6000].forEach(delay => {
      setTimeout(() => {
        events.forEach(({ slug }) => {
          const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
          if (pin && !pin.dataset.dtStyled) {
            pin.dataset.dtStyled = '1';
            styleMarker(pin);
          }
        });
      }, delay);
    });
  }

  /* ─── 7. Retry color injection ─── */

  function retryColorInjection() {
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
      sweepAndStyle();
      console.log('[DT Featured] Colors refreshed after retry.');
    }, 2500);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    featuredSlugs = new Set(events.map(e => e.slug));

    injectGlobalCSS();
    injectPinStyles(events);
    applyCardStripes(events);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const mapEl = getMapContainer();
      if (mapEl) {
        clearInterval(interval);
        setupPinObserver(events);
        retryColorInjection();
        console.log('[DT Featured] Observer active.');
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn('[DT Featured] Map container not found.');
      }
    }, 250);
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
