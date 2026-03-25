/**
 * Drive This – Featured Event Pins
 * Version: 2.0.1
 *
 * Fixes vs 2.0.0:
 *  - @keyframes: transparent → rgba(r,g,b,0) — prevents color-flicker in Safari
 *  - hexToRgb(): added validation guard, returns null on malformed input
 *  - getFeaturedEvents(): deduplicate by slug
 */
(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';

  /* ─── Helpers ─── */

  function makeFeaturedPinUri(color) {
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="${color}" stroke="${color}" stroke-width="3"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function rgbToHex(rgb) {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // FIX Bug 2: validate input is a full 7-char hex before parsing
  function hexToRgb(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
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
    const seen = new Set(); // FIX Bug 3: deduplicate by slug
    const events = [];
    document.querySelectorAll('[data-featured="1"][data-slug]').forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug || seen.has(slug)) return;
      const color = extractColor(el);
      if (!color) return;
      seen.add(slug);
      events.push({
        slug,
        color,
        name: el.dataset.name || el.querySelector('h3')?.textContent?.trim() || slug,
      });
    });
    return events;
  }

  /* ─── 1. Global CSS ─── */

  // NOTE: @keyframes uses CSS custom properties which resolve per-element.
  // We do NOT use 'transparent' here — instead we use --pin-color-zero (rgba at 0 alpha)
  // to ensure smooth interpolation in Safari. (FIX Bug 1)

  function injectGlobalCSS() {
    const existing = document.getElementById('dt-featured-global-css');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'dt-featured-global-css';
    style.textContent = `
      .cru-ncf-pin { cursor: pointer !important; }

      @keyframes dt-glow {
        0%   { box-shadow: 0 0 0 0px  var(--pin-color-a),
                           0 2px  8px var(--pin-color-b); }
        50%  { box-shadow: 0 0 0 9px  var(--pin-color-zero),
                           0 2px 16px var(--pin-color-c); }
        100% { box-shadow: 0 0 0 0px  var(--pin-color-zero),
                           0 2px  8px var(--pin-color-b); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── 2. Pin styles + glow animation ─── */

  function injectPinStyles(events) {
    const existing = document.getElementById('dt-featured-pin-styles');
    if (existing) existing.remove();

    const rules = events.map(({ slug, color }) => {
      const uri = makeFeaturedPinUri(color);
      const rgb = hexToRgb(color);
      if (!rgb) {
        console.warn(`[DT Featured] Could not parse color for slug "${slug}": ${color}`);
        return '';
      }
      return `
        .${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) {
          background-image: ${uri} !important;
          --pin-color-a:    rgba(${rgb}, 0.65);
          --pin-color-b:    rgba(${rgb}, 0.40);
          --pin-color-c:    rgba(${rgb}, 0.60);
          --pin-color-zero: rgba(${rgb}, 0);
          animation: dt-glow 2s ease-in-out infinite !important;
          border-radius: 50% !important;
        }
      `;
    }).filter(Boolean);

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
      const slug  = card.dataset.slug?.trim();
      const color = colorMap[slug] || extractColor(card);
      if (!color) return;
      const stripe  = `inset 0 5px 0 0 ${color}`;
      const current = card.style.boxShadow || '';
      if (!current.includes('inset 0 5px')) {
        card.style.boxShadow = current ? `${current}, ${stripe}` : stripe;
      }
    });
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
      if (firstPin) {
        clearInterval(interval);
        console.log(`[DT Featured] Pins ready. Glow active on ${events.length} event(s).`);
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[DT Featured] Pins not found in DOM after 20s.');
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
