/**
 * Drive This – Dynamic Pin Coloring
 * Dark pin with colored country ring.
 *
 * Version: 3.0.0 (2026-09-04)
 *
 * v3.0.0
 *  - Saved pins keep the country ring. The bookmark marker on a saved pin
 *    is a CSS pseudo-element (map-inline.css), so the old
 *    :not(.is-favorite-pin) exclusion is gone.
 *  - Past-event pins no longer use the "27" glyph. They get the same ring,
 *    faded inside the SVG (PAST_OPACITY) instead of via element opacity,
 *    so the bookmark on a saved past event stays fully opaque.
 *  - Featured pin variants removed (the inline featured-pins script and
 *    featured-cards.js are retired).
 */
(function () {
  'use strict';
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#D45D3F';
  const PAST_OPACITY = 0.3;
  const COLOR_OVERRIDES = {
    'autopia-madrid': '#e96565',
    'klassikwelt-bodensee': '#FABD61',
    'retro-classics-stuttgart': '#FABD61',
    'techno-classica-salon': '#FABD61',
    'concorso-deleganza-villa-deste': '#3adfba',
    'fuori-concorso': '#3adfba',
    'swiss-classic-world': '#f08484',
    'goodwood-festival-of-speed': '#B579F3',
    'sherborne-classic-supercars-show': '#B579F3',
    'belmot-oldtimer-grand-prix': '#FABD61',
    'classic-days-grand-meeting': '#FABD61',
    'bremen-classic-motorshow': '#FABD61',
    'interclassics-maastricht': '#F19E70',
    'carfest-silverstone': '#B579F3',
    'salon-prive-blenheim-palace': '#B579F3',
    'retromobile-paris': '#9ee2ff',
    'caramulo-motorfestival': '#5e9dd9',
    'the-ice-st-moritz': '#f08484',
    'bernina-gran-turismo': '#f08484',
    'goodwood-revival': '#B579F3',
    'zoute-grand-prix-car-week': '#d08b5d',
    'gran-premio-nuvolari': '#3adfba',
    'targa-florio-classica': '#3adfba',
    'auto-e-moto-depoca': '#3adfba',
  };
  function makePinDataUri(color, opacity) {
    const op = opacity === undefined ? '' : ` opacity="${opacity}"`;
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#2a2a3a" stroke="${color}" stroke-width="3"${op}/></svg>`;
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
    const rules = [];
    // Fallback for past pins without colour data (lower specificity than the slug rules below)
    rules.push(`.cru-ncf-pin[ncf-pinstyle="default"].is-past-event { background-image: ${makePinDataUri(FALLBACK_COLOR, PAST_OPACITY)} !important; }`);
    Object.entries(colorMap).forEach(([slug, color]) => {
      rules.push(`.cru-ncf-pin.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"] { background-image: ${makePinDataUri(color)} !important; }`);
      rules.push(`.cru-ncf-pin.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"].is-past-event { background-image: ${makePinDataUri(color, PAST_OPACITY)} !important; }`);
    });
    // Saved pins slightly raised, but BELOW the tooltips
    rules.push(`.mapboxgl-marker:has(.is-favorite-pin) { z-index: 500 !important; }`);
    // Tooltips above everything
    rules.push(`.ncf-tooltip-popup-inner-wrapper { position: relative; z-index: 9999 !important; }`);
    rules.push(`.mapboxgl-popup { z-index: 9999 !important; }`);
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
