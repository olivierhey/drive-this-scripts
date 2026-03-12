/**
 * Drive This – Dynamic Pin Coloring
 * Injects a <style> tag with per-slug CSS rules using !important
 * so Dynamic Map cannot overwrite the colors.
 *
 * Version: 1.5.0
 */

(function () {
  'use strict';

  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#D45D3F';

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
      if (hex) map[slug] = hex;
    });
    return map;
  }

  function injectStyles(colorMap) {
    const existing = document.getElementById('dt-pin-colors');
    if (existing) existing.remove();

    const rules = Object.entries(colorMap).map(([slug, color]) => {
      const uri = makePinDataUri(color);
      return `.${SLUG_CLASS_PREFIX}${slug} { background-image: ${uri} !important; }`;
    });

    // Fallback for pins with no color match
    rules.push(`.cru-ncf-pin:not([class*="${SLUG_CLASS_PREFIX}"]) { background-image: ${makePinDataUri(FALLBACK_COLOR)} !important; }`);

    const style = document.createElement('style');
    style.id = 'dt-pin-colors';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);

    console.log(`[DT Pin Colors] Injected ${rules.length - 1} color rules.`);
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
