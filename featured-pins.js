/**
 * Drive This – Featured Event Pins & Tooltips
 *
 * - Renders featured pins as solid fill (instead of hollow)
 * - Shows permanent label above featured pins at zoom >= ZOOM_THRESHOLD
 *
 * Version: 1.0.0
 */
(function () {
  'use strict';

  const ZOOM_THRESHOLD = 7;
  const SLUG_CLASS_PREFIX = 'ncf-slug-';

  /* ─── SVG helpers ─── */

  function makeFeaturedPinUri(color) {
    // Same shape as pin-colors.js, but fill = color (solid) instead of #2a2a3a (hollow)
    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="${color}" stroke="${color}" stroke-width="3"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function rgbToHex(rgb) {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  /* ─── Data collection ─── */

  function extractColor(el) {
    // Color sits on .bottom child (or inline background-color), not the list item itself
    const selectors = ['.bottom', '[class*="bottom"]', '[class*="footer"]', '[class*="color"]'];
    for (const sel of selectors) {
      const child = el.querySelector(sel);
      if (!child) continue;
      const bg = getComputedStyle(child).backgroundColor;
      const hex = rgbToHex(bg);
      if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
      // Also check inline style
      if (child.style.backgroundColor) {
        const hex2 = rgbToHex(getComputedStyle(child).backgroundColor);
        if (hex2 && hex2 !== '#ffffff' && hex2 !== '#000000') return hex2;
      }
    }
    // Fallback: scan all children with inline background
    for (const child of el.querySelectorAll('[style*="background"]')) {
      const bg = getComputedStyle(child).backgroundColor;
      const hex = rgbToHex(bg);
      if (hex && hex !== '#ffffff' && hex !== '#000000') return hex;
    }
    return null;
  }

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
        lat:  parseFloat(el.dataset.lat),
        lng:  parseFloat(el.dataset.lng),
      });
    });
    return events;
  }

  /* ─── Pin styles ─── */

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
    console.log(`[DT Featured] Injected ${rules.length} filled pin styles.`);
  }

  /* ─── Floating tooltips ─── */

  let tooltipContainer = null;
  let tooltipItems     = []; // [{ el, lat, lng }]
  let activeMap        = null;

  function buildTooltipContainer() {
    if (tooltipContainer) return;

    const mapEl = document.querySelector('.mapboxgl-map');
    if (!mapEl) return;

    tooltipContainer = document.createElement('div');
    tooltipContainer.id = 'dt-featured-labels';
    tooltipContainer.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:5;';
    mapEl.appendChild(tooltipContainer);
  }

  function buildTooltips(events) {
    if (!tooltipContainer) return;

    // Clear existing
    tooltipContainer.innerHTML = '';
    tooltipItems = [];

    events.forEach(({ name, lat, lng }) => {
      if (isNaN(lat) || isNaN(lng)) return;

      const el = document.createElement('div');
      el.className = 'dt-featured-label';
      el.textContent = name;
      el.style.cssText = [
        'position:absolute',
        'transform:translate(-50%, -100%) translateY(-10px)',
        'background:rgba(15,15,15,0.92)',
        'border:1px solid rgba(255,255,255,0.14)',
        'color:#fff',
        'font-size:11px',
        'font-weight:600',
        'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif',
        'white-space:nowrap',
        'padding:5px 9px',
        'border-radius:5px',
        'opacity:0',
        'transition:opacity 0.2s ease',
        'pointer-events:none',
      ].join(';');

      // Arrow
      const arrow = document.createElement('div');
      arrow.style.cssText = [
        'position:absolute',
        'top:100%',
        'left:50%',
        'transform:translateX(-50%)',
        'border:5px solid transparent',
        'border-top-color:rgba(15,15,15,0.92)',
      ].join(';');
      el.appendChild(arrow);

      tooltipContainer.appendChild(el);
      tooltipItems.push({ el, lat, lng });
    });
  }

  function updateTooltips() {
    if (!activeMap || !tooltipItems.length) return;
    const show = activeMap.getZoom() >= ZOOM_THRESHOLD;

    tooltipItems.forEach(({ el, lat, lng }) => {
      if (!show) {
        el.style.opacity = '0';
        return;
      }
      const pos = activeMap.project([lng, lat]);
      el.style.left = `${pos.x}px`;
      el.style.top  = `${pos.y}px`;
      el.style.opacity = '1';
    });
  }

  /* ─── Map instance discovery ─── */

  function getMapInstance() {
    // Mapbox GL JS doesn't expose the map publicly — we scan canvas properties
    const canvases = document.querySelectorAll('.mapboxgl-canvas');
    for (const canvas of canvases) {
      for (const key of Object.getOwnPropertyNames(canvas)) {
        try {
          const val = canvas[key];
          if (val && typeof val === 'object' && typeof val.getZoom === 'function') return val;
        } catch (_) {}
      }
    }
    return null;
  }

  function setupMapListeners(map) {
    activeMap = map;
    map.on('zoom', updateTooltips);
    map.on('move', updateTooltips);
    updateTooltips(); // initial state
    console.log(`[DT Featured] Map listeners attached. Zoom threshold: ${ZOOM_THRESHOLD}`);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    injectPinStyles(events);
    buildTooltipContainer();
    buildTooltips(events);

    // Find map + attach listeners
    let mapAttempts = 0;
    const mapInterval = setInterval(() => {
      mapAttempts++;
      const map = getMapInstance();
      if (map) {
        clearInterval(mapInterval);
        setupMapListeners(map);
      } else if (mapAttempts >= 30) {
        clearInterval(mapInterval);
        console.warn('[DT Featured] Could not find Mapbox map instance.');
      }
    }, 500);

    // Re-run tooltip positions if map re-renders pins (e.g. filter change)
    const mapEl = document.querySelector('.mapboxgl-map');
    if (mapEl) {
      new MutationObserver(() => updateTooltips())
        .observe(mapEl, { childList: true, subtree: true });
    }
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
        console.warn('[DT Featured] No featured events found after 20s — check data-featured attribute.');
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForData);
  } else {
    waitForData();
  }

})();
