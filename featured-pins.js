/**
 * Drive This – Featured Event Pins
 * Version: 1.9.1
 *
 * Changes from 1.9.0:
 *  - FIX: Hover flicker at pin top edge eliminated — pointer-events:none on all
 *    NCF tooltip/label/popup elements inside .mapboxgl-marker breaks the
 *    mouseleave loop that caused the cursor and tooltip to flicker Race condition fix: color fallback #C8A84B prevents silent event drop
 *  - retryColorInjection() re-applies real colors 2.5s after init
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
      // Normal pins 16px — visually subordinate to featured (22px)
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin) { width: 16px !important; height: 16px !important; }`,
      // Glow must not be clipped at any level of the marker stack
      `.mapboxgl-marker { overflow: visible !important; }`,
      `.cru-ncf-pin { overflow: visible !important; }`,
      // Kill NCF's built-in hover tooltip flicker: the tooltip appears above the pin
      // and steals mouseleave, creating an enter/leave loop. pointer-events:none breaks it.
      `.mapboxgl-marker [class*="tooltip"] { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="ncf-tip"] { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="popup"]   { pointer-events: none !important; }`,
      `.mapboxgl-marker [class*="label"]   { pointer-events: none !important; }`,
      // Shared keyframe — individual glow colors injected via CSS custom props per pin
      `@keyframes dt-glow-pulse {`,
      `  0%   { box-shadow: var(--dt-glow-min); }`,
      `  50%  { box-shadow: var(--dt-glow-max); }`,
      `  100% { box-shadow: var(--dt-glow-min); }`,
      `}`,
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── 2. Pin styles ─── */

  function injectPinStyles(events) {
    const existing = document.getElementById('dt-featured-pin-styles');
    if (existing) existing.remove();
    const rules = events.map(({ slug, color }) => {
      const uri = makeFeaturedPinUri(color);
      // Two-layer glow: tight halo + soft outer spread, both in event color
      const glowMin = `0 0 4px 2px ${color}55, 0 0 10px 4px ${color}22`;
      const glowMax = `0 0 8px 5px ${color}99, 0 0 22px 10px ${color}44`;
      return [
        `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) {`,
        `  --dt-glow-min: ${glowMin};`,
        `  --dt-glow-max: ${glowMax};`,
        `  background-image: ${uri} !important;`,
        `  width: 22px !important;`,
        `  height: 22px !important;`,
        `  border-radius: 50% !important;`,
        `  overflow: visible !important;`,
        `  box-shadow: ${glowMin} !important;`,
        `  animation: dt-glow-pulse 2.4s ease-in-out infinite !important;`,
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
      const firstPin = document.querySelector(`.${SLUG_CLASS_PREFIX}${events[0].slug}`);
      const mapEl = getMapContainer();
      if (firstPin && mapEl) {
        clearInterval(interval);
        applyFeaturedMarkerStyles(events);
        retryColorInjection();
        console.log('[DT Featured] Ready.');
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[DT Featured] Map or pins not found.');
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
