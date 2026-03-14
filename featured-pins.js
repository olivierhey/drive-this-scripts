/**
 * Drive This – Featured Event Pins & Tooltips
 *
 * - Renders featured pins as solid fill (instead of hollow)
 * - Injects inset box-shadow stripe on featured cards (no layout shift)
 * - Shows permanent label above featured pins at zoom >= ZOOM_THRESHOLD
 *
 * Version: 1.4.0
 */
(function () {
  'use strict';

  const ZOOM_THRESHOLD = 6;
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const STRIPE_COLOR = '#FFD700';

  let currentZoom = 5;
  let tooltipLayer = null; // absolute div inside map container
  let tooltipMap = {};     // slug -> { labelEl, arrowEl }

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

  /* ─── Data ─── */

  function getFeaturedEvents() {
    const events = [];
    document.querySelectorAll('[data-featured="1"][data-slug]').forEach(el => {
      const slug = el.dataset.slug?.trim();
      if (!slug) return;
      const color = extractColor(el);
      if (!color) return;
      events.push({
        slug,
        color,
        name: el.dataset.name || el.querySelector('h3')?.textContent?.trim() || slug,
      });
    });
    return events;
  }

  /* ─── 1. Pin styles ─── */

  function injectGlobalStyles(events) {
    const existing = document.getElementById('dt-featured-global-styles');
    if (existing) existing.remove();

    // Build selectors for featured pin markers
    const markerSelectors = events.map(({ slug }) =>
      `.mapboxgl-marker:has(.${SLUG_CLASS_PREFIX}${slug})`
    ).join(', ');

    const rules = [
      // Cursor: pointer on all pins
      `.cru-ncf-pin { cursor: pointer !important; }`,
      // Hide NCF's own tooltip popup for featured pins (it overlaps ours)
      `${markerSelectors} ~ .mapboxgl-popup,
       ${markerSelectors} .ncf-tooltip,
       ${markerSelectors} [class*="tooltip"] { display: none !important; }`,
      // Also suppress via NCF tooltip wrapper if it targets featured slugs
      ...events.map(({ slug }) =>
        `.ncf-tooltip-popup-inner-wrapper[data-slug="${slug}"],
         .ncf-tooltip[data-slug="${slug}"] { display: none !important; }`
      ),
    ];

    const style = document.createElement('style');
    style.id = 'dt-featured-global-styles';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
  }

  function injectPinStyles(events) {
    const existing = document.getElementById('dt-featured-pin-styles');
    if (existing) existing.remove();
    const rules = events.map(({ slug, color }) => {
      const uri = makeFeaturedPinUri(color);
      return `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) { background-image: ${uri} !important; }`;
    });
    if (!rules.length) return;
    const style = document.createElement('style');
    style.id = 'dt-featured-pin-styles';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
    console.log(`[DT Featured] Injected ${rules.length} pin style(s).`);
  }

  /* ─── 2. Card stripe (inset = no layout shift) ─── */

  function applyCardStripes() {
    document.querySelectorAll('[data-featured="1"]').forEach(card => {
      const stripe = `inset 0 3px 0 0 ${STRIPE_COLOR}`;
      const current = card.style.boxShadow || '';
      if (!current.includes(stripe)) {
        card.style.boxShadow = current ? `${current}, ${stripe}` : stripe;
      }
    });
  }

  /* ─── 3. Tooltips – rendered in map container, positioned via getBoundingClientRect ─── */

  function getMapContainer() {
    return document.querySelector('.mapboxgl-map') ||
           document.querySelector('.ncf-map-wrapper') ||
           document.querySelector('[class*="ncf-map"]');
  }

  function ensureTooltipLayer() {
    if (tooltipLayer && document.contains(tooltipLayer)) return true;
    const mapEl = getMapContainer();
    if (!mapEl) return false;

    // Map container must be position:relative or absolute for our layer to anchor
    const pos = getComputedStyle(mapEl).position;
    if (pos === 'static') mapEl.style.position = 'relative';

    tooltipLayer = document.createElement('div');
    tooltipLayer.id = 'dt-featured-tooltip-layer';
    tooltipLayer.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:100%', 'height:100%',
      'pointer-events:none',
      'overflow:visible',
      'z-index:9999',
    ].join(';');
    mapEl.appendChild(tooltipLayer);
    return true;
  }

  function createTooltipEl(name) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:absolute',
      'transform:translate(-50%, -100%)',
      'margin-top:0',
      'pointer-events:none',
    ].join(';');

    const label = document.createElement('div');
    label.style.cssText = [
      'background:rgba(15,15,15,0.92)',
      'border:1px solid rgba(255,255,255,0.14)',
      'color:#fff',
      'font-size:11px',
      'font-weight:600',
      'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif',
      'white-space:nowrap',
      'padding:5px 9px',
      'border-radius:5px',
      'position:relative',
    ].join(';');
    label.textContent = name;

    wrap.appendChild(label);
    return wrap;
  }

  function buildTooltips(events) {
    if (!ensureTooltipLayer()) return;
    tooltipLayer.innerHTML = '';
    tooltipMap = {};

    events.forEach(({ slug, name }) => {
      const el = createTooltipEl(name);
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s ease';
      tooltipLayer.appendChild(el);
      tooltipMap[slug] = el;
    });
  }

  function positionTooltips() {
    if (!tooltipLayer) return;
    const mapEl = getMapContainer();
    if (!mapEl) return;
    const mapRect = mapEl.getBoundingClientRect();

    Object.entries(tooltipMap).forEach(([slug, tooltipEl]) => {
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) {
        tooltipEl.style.opacity = '0';
        return;
      }
      const pinRect = pin.getBoundingClientRect();
      if (pinRect.width === 0) {
        return; // pin temporarily removed by Mapbox — don't touch opacity
      }

      // Position relative to map container
      const x = pinRect.left - mapRect.left + pinRect.width / 2;
      const y = pinRect.top  - mapRect.top;

      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top  = `${y}px`;
      tooltipEl.style.opacity = currentZoom >= ZOOM_THRESHOLD ? '1' : '0';
    });
  }

  /* ─── 4. Zoom tracking ─── */

  function setupZoomTracking() {
    const mapEl = getMapContainer();
    if (!mapEl) return;

    // Track zoom level via wheel
    mapEl.addEventListener('wheel', e => {
      currentZoom = Math.max(1, Math.min(14, currentZoom - e.deltaY / 300));
    }, { passive: true });

    // Track zoom via +/- buttons
    document.querySelectorAll('.mapboxgl-ctrl-zoom-in, .mapboxgl-ctrl-zoom-out').forEach(btn => {
      btn.addEventListener('click', () => {
        const isIn = btn.classList.contains('mapboxgl-ctrl-zoom-in');
        currentZoom = Math.max(1, Math.min(14, currentZoom + (isIn ? 1 : -1)));
      });
    });

    // RAF loop: reposition on every frame (handles pan + zoom + resize)
    function loop() {
      positionTooltips();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    console.log(`[DT Featured] RAF loop active. Threshold: ${ZOOM_THRESHOLD}`);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    injectGlobalStyles(events);
    injectPinStyles(events);
    applyCardStripes();

    // Wait for pins + map to be in DOM
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const firstPin = document.querySelector(`.${SLUG_CLASS_PREFIX}${events[0].slug}`);
      const mapEl = getMapContainer();
      if (firstPin && mapEl) {
        clearInterval(interval);
        buildTooltips(events);
        positionTooltips();
        setupZoomTracking();
        
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
        console.log(`[DT Featured] Found ${events.length} featured event(s):`, events.map(e => e.slug));
        init(events);
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[DT Featured] No featured events found — check data-featured="1".');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForData);
  } else {
    waitForData();
  }

})();
