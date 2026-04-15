/**
 * Drive This – Dynamic Pin Coloring
 * Dark pin with colored country ring.
 *
 * Version: 2.2.1
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
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#2a2a3a" stroke="${color}" stroke-width="3"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  function makePastPinDataUri(color) {
    const svg = `<svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c1)"><path d="M10.5 0C16.299 0 21 4.70101 21 10.5C21 16.299 16.299 21 10.5 21C4.70101 21 0 16.299 0 10.5C0 4.70101 4.70101 0 10.5 0ZM8.31543 7.3916C7.03657 7.39176 6.26442 8.06273 6.10059 9.26367H7.66113C7.75476 8.99093 7.91851 8.84277 8.17578 8.84277C8.4482 8.84306 8.59659 8.99093 8.59668 9.2168C8.59668 9.41172 8.50247 9.62251 8.30762 9.84082L6.17871 12.2822V13H10.4141V11.6816H8.72168L9.71973 10.543C10.1252 10.0751 10.3828 9.65326 10.3828 9.06836C10.3826 8.06254 9.55518 7.39178 8.31543 7.3916ZM10.7354 7.54004V8.94434H12.998L11.001 13H12.8574L15.0566 8.39844V7.54004H10.7354Z" fill="${color}"/></g><defs><clipPath id="c1"><rect width="21" height="21" fill="white"/></clipPath></defs></svg>`;
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

    // Aktive Pins: :not(.is-past-event) damit Past Events nicht überschrieben werden
    Object.entries(colorMap).forEach(([slug, color]) => {
      const uri = makePinDataUri(color);
      rules.push(`.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin):not(.is-past-event) { background-image: ${uri} !important; }`);
    });

    // Past-event pins: per Slug mit Länderfarbe, exakte Grösse 21x21
    Object.entries(colorMap).forEach(([slug, color]) => {
      const uri = makePastPinDataUri(color);
      rules.push(
        `.${SLUG_CLASS_PREFIX}${slug}.is-past-event:not(.is-favorite-pin) { ` +
        `background-image: ${uri} !important; ` +
        `width: 21px !important; height: 21px !important; ` +
        `background-size: contain !important; background-repeat: no-repeat !important; }`
      );
    });

    // Fallback für Past Events ohne Slug-Match
    rules.push(
      `.cru-ncf-pin.is-past-event:not(.is-favorite-pin) { ` +
      `background-image: ${makePastPinDataUri(FALLBACK_COLOR)} !important; ` +
      `width: 21px !important; height: 21px !important; ` +
      `background-size: contain !important; background-repeat: no-repeat !important; }`
    );

    // Favorite pins leicht erhöht, aber UNTER den Tooltips
    rules.push(`.mapboxgl-marker:has(.is-favorite-pin) { z-index: 500 !important; }`);
    // Tooltips über alles
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
