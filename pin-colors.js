/**
 * Drive This – Dynamic Pin Coloring
 * Replaces the CSS background-image of each map pin with a
 * dynamically colored SVG data URI, matched via CMS slug → color.
 *
 * Version: 1.2.0
 */

(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const PIN_SELECTOR = '.cru-ncf-pin';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#D45D3F';
  const OBSERVER_TIMEOUT_MS = 10000;

  /** Generate an SVG data URI with the given fill color */
  function makePinDataUri(color) {
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="${color}" stroke="white" stroke-width="3"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  /** Convert rgb(r, g, b) → #rrggbb */
  function rgbToHex(rgb) {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return null;
    return '#' + [match[1], match[2], match[3]]
      .map(n => parseInt(n).toString(16).padStart(2, '0'))
      .join('');
  }

  /** Build slug → hex color map from hidden Collection List */
  function buildColorMap() {
    const map = {};
    document.querySelectorAll(DATA_SELECTOR).forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug) return;
      const bg = getComputedStyle(el).backgroundColor;
      const hex = rgbToHex(bg);
      if (hex) map[slug] = hex;
    });
    return map;
  }

  /** Extract slug from pin class list */
  function getSlugFromPin(pinEl) {
    const slugClass = [...pinEl.classList].find(c =>
      c.startsWith(SLUG_CLASS_PREFIX)
    );
    return slugClass ? slugClass.slice(SLUG_CLASS_PREFIX.length) : null;
  }

  /** Apply colored background-image to a single pin */
  function applyColorToPin(pinEl, color) {
    pinEl.style.backgroundImage = makePinDataUri(color);
  }

  /** Color all currently rendered pins */
  function colorAllPins(colorMap) {
    document.querySelectorAll(PIN_SELECTOR).forEach(pin => {
      // Skip already colored pins to avoid redundant work
      if (pin.dataset.dtColored) return;
      const slug = getSlugFromPin(pin);
      if (!slug) return;
      const color = colorMap[slug] || FALLBACK_COLOR;
      applyColorToPin(pin, color);
      pin.dataset.dtColored = '1';
    });
  }

  function init() {
    const colorMap = buildColorMap();

    if (Object.keys(colorMap).length === 0) {
      console.warn('[DT Pin Colors] No color data found. Check hidden Collection List has data-slug and BG color bound.');
      return;
    }

    console.log(`[DT Pin Colors] Loaded ${Object.keys(colorMap).length} event colors.`);

    colorAllPins(colorMap);

    const observer = new MutationObserver(() => colorAllPins(colorMap));
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => observer.disconnect(), OBSERVER_TIMEOUT_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
