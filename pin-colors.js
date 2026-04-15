/**
 * Drive This – Dynamic Pin Coloring
 * Dark pin with colored country ring.
 *
 * Version: 2.1.0
 */
(function () {
  'use strict';
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const DATA_SELECTOR = '[data-slug]';
  const FALLBACK_COLOR = '#D45D3F';
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
  };
  function makePinDataUri(color) {
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#2a2a3a" stroke="${color}" stroke-width="3"/></svg>`;
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
    // Past-event pins: Länderfarbe als "27"-SVG, Opacity kommt aus Page CSS
    function makePastPinDataUri(color) {
      const svg = `<svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c2)"><path d="M14.5 8.5C14.5 5.18629 11.8137 2.5 8.5 2.5C5.18629 2.5 2.5 5.18629 2.5 8.5C2.5 11.8137 5.18629 14.5 8.5 14.5V17C3.80558 17 0 13.1944 0 8.5C0 3.80558 3.80558 0 8.5 0C13.1944 0 17 3.80558 17 8.5C17 13.1944 13.1944 17 8.5 17V14.5C11.8137 14.5 14.5 11.8137 14.5 8.5Z" fill="${color}"/><path d="M6.41504 5.3916C7.65506 5.3916 8.48219 6.0624 8.48242 7.06836C8.48242 7.65336 8.22494 8.07497 7.81934 8.54297L6.82129 9.68164H8.51367V11H4.27832V10.2822L6.40723 7.84082C6.60223 7.62242 6.69629 7.4118 6.69629 7.2168C6.69621 6.99081 6.54806 6.84292 6.27539 6.84277C6.01799 6.84277 5.85337 6.99067 5.75977 7.26367H4.2002C4.36401 6.06265 5.13609 5.39173 6.41504 5.3916ZM13.1562 6.39844L10.957 11H9.10059L11.0977 6.94434H8.83496V5.54004H13.1562V6.39844Z" fill="${color}"/></g><defs><clipPath id="c2"><rect width="17" height="17" fill="white"/></clipPath></defs></svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
    Object.entries(colorMap).forEach(([slug, color]) => {
      rules.push(`.cru-ncf-pin.${SLUG_CLASS_PREFIX}${slug}.is-past-event:not(.is-favorite-pin) { background-image: ${makePastPinDataUri(color)} !important; width: 18px !important; height: 18px !important; background-size: contain !important; }`);
    });
    rules.push(`.cru-ncf-pin.is-past-event:not(.is-favorite-pin) { background-image: ${makePastPinDataUri(FALLBACK_COLOR)} !important; width: 18px !important; height: 18px !important; background-size: contain !important; }`);
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
