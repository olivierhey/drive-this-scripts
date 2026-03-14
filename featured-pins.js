/**
 * Drive This – Featured Event Pins & Tooltips
 *
 * - Renders featured pins as solid fill (instead of hollow)
 * - Injects inset box-shadow stripe on featured cards (no layout shift)
 * - Shows permanent label above featured pins at zoom >= ZOOM_THRESHOLD
 *
 * Version: 1.1.0
 */
(function () {
  'use strict';

  const ZOOM_THRESHOLD = 7;
  const SLUG_CLASS_PREFIX = 'ncf-slug-';
  const STRIPE_COLOR = '#FFD700';

  let currentZoom = 5;

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

  /* ─── 3. Tooltips ─── */

  function makeTooltipEl(name) {
    const el = document.createElement('div');
    el.className = 'dt-featured-label';
    el.style.cssText = [
      'position:absolute',
      'bottom:calc(100% + 8px)',
      'left:50%',
      'transform:translateX(-50%)',
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
      'z-index:9999',
    ].join(';');
    el.appendChild(document.createTextNode(name));

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
    return el;
  }

  function attachTooltips(events) {
    events.forEach(({ slug, name }) => {
      const pin = document.querySelector(`.${SLUG_CLASS_PREFIX}${slug}`);
      if (!pin) return;
      if (pin.querySelector('.dt-featured-label')) return; // already attached
      if (getComputedStyle(pin).position === 'static') pin.style.position = 'relative';
      pin.appendChild(makeTooltipEl(name));
    });
    updateTooltipVisibility();
  }

  function updateTooltipVisibility() {
    const show = currentZoom >= ZOOM_THRESHOLD;
    document.querySelectorAll('.dt-featured-label').forEach(t => {
      t.style.opacity = show ? '1' : '0';
    });
  }

  /* ─── 4. Zoom tracking ─── */

  function setupZoomTracking() {
    const mapEl = document.querySelector('.mapboxgl-map, .ncf-map-wrapper, [class*="ncf-map"]');
    if (!mapEl) return;

    mapEl.addEventListener('wheel', e => {
      currentZoom = Math.max(1, Math.min(14, currentZoom - e.deltaY / 300));
      updateTooltipVisibility();
    }, { passive: true });

    document.querySelectorAll('.mapboxgl-ctrl-zoom-in, .mapboxgl-ctrl-zoom-out').forEach(btn => {
      btn.addEventListener('click', () => {
        const isIn = btn.classList.contains('mapboxgl-ctrl-zoom-in');
        currentZoom = Math.max(1, Math.min(14, currentZoom + (isIn ? 1 : -1)));
        updateTooltipVisibility();
      });
    });

    // Re-attach if NCF re-renders pins
    new MutationObserver(() => {
      setTimeout(() => attachTooltips(window._dtFeaturedEvents || []), 300);
    }).observe(mapEl, { childList: true, subtree: true });

    console.log(`[DT Featured] Zoom tracking active. Threshold: ${ZOOM_THRESHOLD}`);
  }

  /* ─── Bootstrap ─── */

  function init(events) {
    window._dtFeaturedEvents = events;
    injectPinStyles(events);
    applyCardStripes();

    // Wait for pins to appear, then attach tooltips
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const firstPin = document.querySelector(`.${SLUG_CLASS_PREFIX}${events[0].slug}`);
      if (firstPin) {
        clearInterval(interval);
        attachTooltips(events);
        setupZoomTracking();
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[DT Featured] Pins not found in DOM.');
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
