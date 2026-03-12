/**
 * Drive This – Dynamic Pin Coloring
 * Dark pin with colored country ring.
 *
 * Version: 1.9.0
 */

(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#D45D3F';

  const COLOR_OVERRIDES = {
    'autopia-madrid': '#e96565',
    'klassikwelt-bodensee': '#fabd61',
    'techno-classica-salon': '#fabd61',
  };

  function makePinDataUri(color) {
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="#2a2a3a" stroke="${color}" stroke-width="3"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function rgbToHex(rgb) {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return null;
    return '#' + [match[1], match[2], match[3]]
      .map(n => parseInt(n).toString(16).padStart(2, '0'))
      .join('');
  }

  function buildColorMap() {
    const map = {};
    document.querySelectorAll(DATA_SELECTOR).forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug) return;
      const bg = getComputedStyle(el).backgroundColor;
      const hex = rgbToHex(bg);
      if (hex && hex !== '#ffffff' && hex !== '#000000') {
        map[slug] = hex;
      }
    });
    Object.assign(map, COLOR_OVERRIDES);
    return map;
  }

  function injectStyles(colorMap) {
    const existing = document.getElementById('dt-pin-colors');
    if (existing) existing.remove();

    const rules = Object.entries(colorMap).map(([slug, color]) => {
      const uri = makePinDataUri(color);
      return `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) { background-image: ${uri} !important; }`;
    });

    // Favorite pins always on top
    rules.push(`.cru-ncf-pin.is-favorite-pin { z-index: 9999 !important; }`);

    const style = document.createElement('style');
    style.id = 'dt-pin-colors';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);

    console.log(`[DT Pin Colors] Injected ${rules.length} color rules.`);
  }

  function init() {
    const colorMap = buildColorMap();
    if (Object.keys(colorMap).length === 0) {
      console.warn('[DT Pin Colors] No color data found.');
      return;
    }
    injectStyles(colorMap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
