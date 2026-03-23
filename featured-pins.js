/**
 * Drive This – Featured Event Pins & Tooltips
 * Version: 1.7.0
 *
 * Changes from 1.6.2:
 *  - Drawer awareness: tooltips hidden immediately when drawer opens,
 *    restored (with short delay) when drawer closes.
 *  - positionTooltips() now skips silently if drawer is open.
 *  - Click-reposition calls respect drawer state.
 *  - setupDrawerAwareness() wired into init().
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
    style.textContent = `.cru-ncf-pin { cursor: pointer !important; }`;
    document.head.appendChild(style);
  }

  /* ─── 2. Pin styles ─── */

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

  /* ─── 5. Position tooltips ─── */

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

  /* ─── 6. Scheduled reposition (RAF-debounced) ─── */

  function scheduleReposition() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      positionTooltips();
    });
  }

  /* ─── 7. Drawer awareness ────────────────────────────────────────────────
   *
   * Observes the drawer's class list.
   * - When drawer opens (.is-active added): hide all tooltips immediately.
   * - When drawer closes (.is-active removed): wait briefly, then reposition.
   *
   * This is the core fix for the blink: tooltips are killed the moment the
   * drawer starts opening, so there is nothing left to flicker.
   *
   * ─────────────────────────────────────────────────────────────────────── */
  function setupDrawerAwareness() {
    const drawerEl = document.getElementById('dt-drawer');
    if (!drawerEl) {
      // Drawer HTML may not exist yet — retry
      setTimeout(setupDrawerAwareness, 500);
      return;
    }

    new MutationObserver(() => {
      if (drawerEl.classList.contains('is-active')) {
        // Drawer just opened → immediately hide tooltips
        Object.values(tooltipMap).forEach(wrap => {
          wrap.style.opacity = '0';
        });
      } else {
        // Drawer just closed → restore after transition finishes (~350ms)
        setTimeout(positionTooltips, 400);
      }
    }).observe(drawerEl, { attributes: true, attributeFilter: ['class'] });

    console.log('[DT Featured] Drawer awareness active.');
  }

  /* ─── 8. Event listeners ─── */

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

    // Pin click → map fly-to animation → reposition during animation.
    // Each call checks isDrawerOpen() and bails out if open.
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
        setupDrawerAwareness(); // ← new
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
