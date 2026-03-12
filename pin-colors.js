/**
 * Drive This – Dynamic Pin Coloring
 * Reads country colors from a hidden Webflow Collection List
 * (BG color bound to CMS Color field, data-slug bound to CMS Slug).
 * Applies colors to Dynamic Map pin SVGs via slug matching.
 *
 * Version: 1.1.0
 */

(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const PIN_SELECTOR = '.cru-ncf-pin';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#E05C3A';
  const OBSERVER_TIMEOUT_MS = 10000;

  /** Convert rgb(r, g, b) string returned by getComputedStyle to #rrggbb */
  function rgbToHex(rgb) {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return null;
    return '#' + [match[1], match[2], match[3]]
      .map(n => parseInt(n).toString(16).padStart(2, '0'))
      .join('');
  }

  /** Build slug → hex color map from the hidden Collection List */
  function buildColorMap() {
    const map = {};
    document.querySelectorAll(DATA_SELECTOR).forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug) return;
      // Read the CMS color via computed background-color
      const bg = getComputedStyle(el).backgroundColor;
      const hex = rgbToHex(bg);
      if (hex) map[slug] = hex;
    });
    return map;
  }

  /** Extract slug from pin class list, e.g. "ncf-slug-retro-classics-essen" */
  function getSlugFromPin(pinEl) {
    const slugClass = [...pinEl.classList].find(c =>
      c.startsWith(SLUG_CLASS_PREFIX)
    );
    return slugClass ? slugClass.slice(SLUG_CLASS_PREFIX.length) : null;
  }

  /** Apply color to all filled SVG shapes inside a pin */
  function applyColorToPin(pinEl, color) {
    pinEl.querySelectorAll('svg path, svg circle, svg rect, svg ellipse').forEach(shape => {
      const fill = shape.getAttribute('fill');
      if (fill && fill !== 'none') {
        shape.setAttribute('fill', color);
      }
    });
    pinEl.querySelectorAll('svg [style*="fill"]').forEach(shape => {
      shape.style.fill = color;
    });
  }

  /** Color all currently rendered pins */
  function colorAllPins(colorMap) {
    document.querySelectorAll(PIN_SELECTOR).forEach(pin => {
      const slug = getSlugFromPin(pin);
      if (!slug) return;
      const color = colorMap[slug] || FALLBACK_COLOR;
      applyColorToPin(pin, color);
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
