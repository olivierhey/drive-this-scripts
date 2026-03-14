/**
 * Drive This – Featured Event Pins & Tooltips
 * Version: 1.5.0
 */
(function () {
  'use strict';

  const ZOOM_THRESHOLD = 5;
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const STRIPE_COLOR = '#FFD700';

  let currentZoom = 4;
  let tooltipLayer = null;
  let tooltipMap = {}; // slug -> wrapEl

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
    console.log(`[DT Featured] ${rules.length} pin style(s) injected.`);
  }

  /* ─── 2. Card stripes ─── */

  function applyCardStripes() {
    document.querySelectorAll('[data-featured="1"]').forEach(card => {
      const stripe = `inset 0 3px 0 0 ${STRIPE_COLOR}`;
      const current = card.style.boxShadow || '';
      if (!current.includes(stripe)) {
        card.style.boxShadow = current ? `${current}, ${stripe}` : stripe;
      }
    });
  }

  /* ─── 3. NCF hover-tooltip suppression (for featured pins only) ─── */

  function suppressNCFTooltips(slugs) {
    // Watch for NCF tooltip popups and hide them if they belong to a featured pin
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.ncf-tooltip, [class*="ncf-tooltip"], .mapboxgl-popup').forEach(popup => {
        const text = popup.textContent?.trim();
        // Check if popup text matches any featured event name
        const isFeatured = slugs.some(slug => {
          const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
          const name = pin?.closest('[data-name]')?.dataset?.name ||
                       document.querySelector(`[data-slug="${slug}"]`)?.dataset?.name || '';
          return name && text && text.includes(name.substring(0, 10));
        });
        if (isFeatured) popup.style.display = 'none';
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 4. Tooltip layer ─── */

  function getMapContainer() {
    return document.querySelector('.mapboxgl-map') ||
           document.querySelector('.ncf-map-wrapper') ||
           document.querySelector('[class*="ncf-map"]');
  }

  function ensureTooltipLayer() {
    if (tooltipLayer && document.contains(tooltipLayer)) return true;
    const mapEl = getMapContainer();
    if (!mapEl) return false;
    const pos = getComputedStyle(mapEl).position;
    if (pos === 'static') mapEl.style.position = 'relative';
    tooltipLayer = document.createElement('div');
    tooltipLayer.id = 'dt-featured-tooltip-layer';
    tooltipLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:9999;';
    mapEl.appendChild(tooltipLayer);
    return true;
  }

  function buildTooltips(events) {
    if (!ensureTooltipLayer()) return;
    tooltipLayer.innerHTML = '';
    tooltipMap = {};
    events.forEach(({ slug, name }) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;transform:translate(-50%,-100%);pointer-events:none;margin-top:-10px;';
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
      ].join(';');
      label.textContent = name;
      wrap.appendChild(label);
      wrap.style.opacity = '0';
      tooltipLayer.appendChild(wrap);
      tooltipMap[slug] = wrap;
    });
  }

  /* ─── 5. Position + visibility ─── */

  function positionTooltips() {
    if (!tooltipLayer) return;
    const mapEl = getMapContainer();
    if (!mapEl) return;
    const mapRect = mapEl.getBoundingClientRect();
    const show = currentZoom >= ZOOM_THRESHOLD;

    Object.entries(tooltipMap).forEach(([slug, wrap]) => {
      if (!show) {
        if (wrap.style.opacity !== '0') wrap.style.opacity = '0';
        return;
      }
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) return;
      const pinRect = pin.getBoundingClientRect();
      if (pinRect.width === 0) return;

      const x = Math.round(pinRect.left - mapRect.left + pinRect.width / 2);
      const y = Math.round(pinRect.top - mapRect.top);
      const newLeft = `${x}px`;
      const newTop = `${y}px`;

      // Only write to DOM if value actually changed (avoids triggering Mapbox hover)
      if (wrap.style.left !== newLeft) wrap.style.left = newLeft;
      if (wrap.style.top  !== newTop)  wrap.style.top  = newTop;
      if (wrap.style.opacity !== '1')  wrap.style.opacity = '1';
    });
  }

  /* ─── 6. Zoom tracking ─── */

  function setupZoomTracking() {
    const mapEl = getMapContainer();
    if (!mapEl) return;

    mapEl.addEventListener('wheel', e => {
      currentZoom = Math.max(1, Math.min(14, currentZoom - e.deltaY / 300));
    }, { passive: true });

    document.querySelectorAll('.mapboxgl-ctrl-zoom-in, .mapboxgl-ctrl-zoom-out').forEach(btn => {
      btn.addEventListener('click', () => {
        const isIn = btn.classList.contains('mapboxgl-ctrl-zoom-in');
        currentZoom = Math.max(1, Math.min(14, currentZoom + (isIn ? 1 : -1)));
      });
    });

    // RAF loop for smooth pan tracking — only writes to DOM when value changes
    function loop() {
      positionTooltips();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    console.log(`[DT Featured] Ready. Zoom threshold: ${ZOOM_THRESHOLD}`);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    injectPinStyles(events);
    applyCardStripes();
    suppressNCFTooltips(events.map(e => e.slug));

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const firstPin = document.querySelector(`.${SLUG_CLASS_PREFIX}${events[0].slug}`);
      const mapEl = getMapContainer();
      if (firstPin && mapEl) {
        clearInterval(interval);
        buildTooltips(events);
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
