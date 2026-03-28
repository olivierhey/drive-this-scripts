/**
 * Drive This – Featured Event Pins & Tooltips
 * Version: 1.8.1
 *
 * Changes from 1.8.0:
 *  - Normal pins: 16px, Featured pins: 22px
 *  - Glow restored: self-contained box-shadow in injectPinStyles(), no longer
 *    dependent on map-extras.js (which was being overridden by background-image)
 */
(function () {
  'use strict';

  const ZOOM_THRESHOLD = 5;
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  let currentZoom = 4;
  let tooltipLayer = null;
  let tooltipMap = {}; // slug -> wrapEl
  let rafId = null;

  /* ─── Helpers ─── */

  function makeFeaturedPinUri(color) {
    const svg = `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8" fill="${color}" stroke="${color}" stroke-width="2.5"/></svg>`;
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
      // FIX: Previously `if (!color) return` silently dropped events when Webflow CSS
      // wasn't fully applied yet — caused ~50% load failure. Now falls back to Drive This
      // gold and retryColorInjection() will patch real colors 2.5s later.
      const color = extractColor(el) || '#C8A84B';
      events.push({
        slug,
        color,
        name: el.dataset.name || el.querySelector('h3')?.textContent?.trim() || slug,
      });
    });
    return events;
  }

  /* ─── Drawer state helper ─── */

  function isDrawerOpen() {
    const drawerEl = document.getElementById('dt-drawer');
    return drawerEl ? drawerEl.classList.contains('is-active') : false;
  }

  /* ─── 1. Global CSS ─── */

  function injectGlobalCSS() {
    const existing = document.getElementById('dt-featured-global-css');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'dt-featured-global-css';
    style.textContent = [
      // Cursor
      `.cru-ncf-pin { cursor: pointer !important; }`,
      // FIX: Normal pins reduced to 16px for stronger visual hierarchy vs featured (22px)
      `.cru-ncf-pin[ncf-pinstyle="default"]:not(.is-favorite-pin) { width: 16px !important; height: 16px !important; }`,
      // FIX: Glow must not be clipped by marker container
      `.mapboxgl-marker { overflow: visible !important; }`,
      `.cru-ncf-pin { overflow: visible !important; }`,
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ─── 2. Pin styles ─── */

  function injectPinStyles(events) {
    const existing = document.getElementById('dt-featured-pin-styles');
    if (existing) existing.remove();
    const rules = events.map(({ slug, color }) => {
      const uri = makeFeaturedPinUri(color);
      // Glow via box-shadow — self-contained, not dependent on map-extras.js.
      // Two layers: tight halo (40% opacity) + soft outer glow (20% opacity).
      // Hex alpha: 66 = ~40%, 33 = ~20%
      const glow = `0 0 6px 3px ${color}66, 0 0 18px 8px ${color}33`;
      return [
        `.${SLUG_CLASS_PREFIX}${slug}[ncf-pinstyle="default"]:not(.is-favorite-pin) {`,
        `  background-image: ${uri} !important;`,
        `  width: 22px !important;`,
        `  height: 22px !important;`,
        `  border-radius: 50% !important;`,
        `  overflow: visible !important;`,
        `  box-shadow: ${glow} !important;`,
        `}`,
      ].join('\n');
    });
    if (!rules.length) return;
    const style = document.createElement('style');
    style.id = 'dt-featured-pin-styles';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
    console.log(`[DT Featured] ${rules.length} pin style(s) injected.`);
  }

  /* ─── 3. Card stripes ─── */

  function applyCardStripes(events) {
    const colorMap = {};
    events.forEach(({ slug, color }) => { colorMap[slug] = color; });

    document.querySelectorAll('[data-featured="1"][data-slug]').forEach(card => {
      const slug = card.dataset.slug?.trim();
      const color = colorMap[slug] || extractColor(card);
      if (!color) return;
      const stripe = `inset 0 5px 0 0 ${color}`;
      const current = card.style.boxShadow || '';
      if (!current.includes('inset 0 5px')) {
        card.style.boxShadow = current ? `${current}, ${stripe}` : stripe;
      }
    });
  }

  /* ─── 4. Apply z-index + overflow to .mapboxgl-marker parents ─── */

  function applyFeaturedMarkerStyles(events) {
    events.forEach(({ slug }) => {
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) return;
      // FIX: Set z-index on the actual Mapbox marker wrapper so featured pins
      // always render above normal pins
      const marker = pin.closest('.mapboxgl-marker');
      if (marker) {
        marker.style.zIndex = '100';
        marker.style.overflow = 'visible';
      }
    });
  }

  /* ─── 5. Retry color injection ─── */

  function retryColorInjection() {
    // FIX: 2.5s after init, re-check colors now that Webflow CSS is fully applied.
    // Updates any pins that got the fallback gold color on first pass.
    setTimeout(() => {
      if (!window._dtFeaturedEvents?.length) return;
      const updated = [];
      document.querySelectorAll('[data-featured="1"][data-slug]').forEach(el => {
        const slug = el.dataset.slug?.trim();
        if (!slug) return;
        const color = extractColor(el);
        if (color && color !== '#C8A84B') updated.push({ slug, color });
      });
      if (!updated.length) return;
      window._dtFeaturedEvents = window._dtFeaturedEvents.map(ev => {
        const u = updated.find(e => e.slug === ev.slug);
        return u ? { ...ev, color: u.color } : ev;
      });
      injectPinStyles(window._dtFeaturedEvents);
      applyFeaturedMarkerStyles(window._dtFeaturedEvents);
      console.log('[DT Featured] Colors refreshed after retry.');
    }, 2500);
  }

  /* ─── 6. Tooltip layer ─── */

  function getMapContainer() {
    return document.querySelector('.mapboxgl-map') ||
           document.querySelector('.ncf-map-wrapper') ||
           document.querySelector('[class*="ncf-map"]');
  }

  function ensureTooltipLayer() {
    if (tooltipLayer && document.contains(tooltipLayer)) return true;
    const mapEl = getMapContainer();
    if (!mapEl) return false;
    if (getComputedStyle(mapEl).position === 'static') mapEl.style.position = 'relative';
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
      wrap.style.cssText = 'position:absolute;transform:translate(-50%,-100%);pointer-events:none;padding-bottom:6px;opacity:0;';
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
      tooltipLayer.appendChild(wrap);
      tooltipMap[slug] = wrap;
    });
  }

  /* ─── 7. Position tooltips ─── */

  function positionTooltips() {
    if (!tooltipLayer) return;

    // Don't touch tooltips while the drawer is open — avoids blink on mobile
    if (isDrawerOpen()) return;

    const mapEl = getMapContainer();
    if (!mapEl) return;
    const mapRect = mapEl.getBoundingClientRect();
    const show = currentZoom >= ZOOM_THRESHOLD;

    Object.entries(tooltipMap).forEach(([slug, wrap]) => {
      if (!show) {
        wrap.style.opacity = '0';
        return;
      }
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) return;
      const pinRect = pin.getBoundingClientRect();
      if (pinRect.width === 0) return;

      const x = Math.round(pinRect.left - mapRect.left + pinRect.width / 2);
      const y = Math.round(pinRect.top - mapRect.top);
      const newLeft = `${x}px`;
      const newTop  = `${y}px`;
      if (wrap.style.left !== newLeft) wrap.style.left = newLeft;
      if (wrap.style.top  !== newTop)  wrap.style.top  = newTop;
      wrap.style.opacity = '1';
    });
  }

  /* ─── 8. Scheduled reposition (RAF-debounced) ─── */

  function scheduleReposition() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      positionTooltips();
    });
  }

  /* ─── 9. Drawer awareness ────────────────────────────────────────────────
   *
   * Observes the drawer's class list.
   * - When drawer opens (.is-active added): hide all tooltips immediately.
   * - When drawer closes (.is-active removed): wait briefly, then reposition.
   *
   * ─────────────────────────────────────────────────────────────────────── */
  function setupDrawerAwareness() {
    const drawerEl = document.getElementById('dt-drawer');
    if (!drawerEl) {
      setTimeout(setupDrawerAwareness, 500);
      return;
    }

    new MutationObserver(() => {
      if (drawerEl.classList.contains('is-active')) {
        Object.values(tooltipMap).forEach(wrap => {
          wrap.style.opacity = '0';
        });
      } else {
        setTimeout(positionTooltips, 400);
      }
    }).observe(drawerEl, { attributes: true, attributeFilter: ['class'] });

    console.log('[DT Featured] Drawer awareness active.');
  }

  /* ─── 10. Event listeners ─── */

  function setupEventListeners() {
    const mapEl = getMapContainer();
    if (!mapEl) return;

    // Zoom via scroll wheel
    mapEl.addEventListener('wheel', e => {
      currentZoom = Math.max(1, Math.min(14, currentZoom - e.deltaY / 300));
      scheduleReposition();
    }, { passive: true });

    // Zoom via +/- buttons
    document.querySelectorAll('.mapboxgl-ctrl-zoom-in, .mapboxgl-ctrl-zoom-out').forEach(btn => {
      btn.addEventListener('click', () => {
        const isIn = btn.classList.contains('mapboxgl-ctrl-zoom-in');
        currentZoom = Math.max(1, Math.min(14, currentZoom + (isIn ? 1 : -1)));
        scheduleReposition();
      });
    });

    // Pan
    let isPanning = false;
    const canvas = mapEl.querySelector('.mapboxgl-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', () => { isPanning = true; });
      window.addEventListener('mouseup', () => { isPanning = false; });
      canvas.addEventListener('mousemove', () => {
        if (isPanning) scheduleReposition();
      });
      canvas.addEventListener('touchmove', scheduleReposition, { passive: true });
    }

    // Window resize
    window.addEventListener('resize', scheduleReposition);

    // Pin click → map fly-to animation → reposition during animation
    mapEl.addEventListener('click', () => {
      [100, 300, 600, 1000].forEach(delay => {
        setTimeout(positionTooltips, delay);
      });
    });

    // Initial positioning
    setTimeout(positionTooltips, 800);
    setTimeout(positionTooltips, 1500);

    console.log(`[DT Featured] Ready. Zoom threshold: ${ZOOM_THRESHOLD}`);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    injectGlobalCSS();
    injectPinStyles(events);
    applyCardStripes(events);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const firstPin = document.querySelector(`.${SLUG_CLASS_PREFIX}${events[0].slug}`);
      const mapEl = getMapContainer();
      if (firstPin && mapEl) {
        clearInterval(interval);
        buildTooltips(events);
        setupEventListeners();
        setupDrawerAwareness();
        applyFeaturedMarkerStyles(events); // FIX: z-index + overflow on marker wrapper
        retryColorInjection();              // FIX: re-apply real colors after CSS settles
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
