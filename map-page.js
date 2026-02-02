/**
 * Drive This - Map Page Scripts
 * Horizontal scroll UX enhancement for event list
 * Version: 1.0.0
 */

(function() {
  'use strict';

  // === CONFIGURATION ===
  const CONFIG = {
    scrollAmount: 320,      // Pixels per chevron click
    fadeThreshold: 20,      // Show chevron when scrolled past this
    dragMultiplier: 1.5,    // Drag speed multiplier
    selectors: {
      list: '.cru-ncf-map-item-list',
      wrapper: '.horizontal-scroll'
    }
  };

  // === CHEVRON SVG ICONS ===
  const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>';
  const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg>';

  /**
   * Initialize horizontal scroll enhancement
   */
  function initScrollEnhancement() {
    const container = document.querySelector(CONFIG.selectors.list);
    if (!container) {
      console.warn('[Drive This] Event list container not found');
      return;
    }

    const wrapper = container.closest(CONFIG.selectors.wrapper) || container.parentElement;
    wrapper.style.position = 'relative';

    // Create chevrons
    const chevrons = createChevrons(wrapper, container);
    
    // Setup drag-to-scroll
    setupDragScroll(container);
    
    // Setup wheel Y→X translation
    setupWheelScroll(container);
    
    // Setup scroll listener for chevron visibility
    setupScrollListener(container, chevrons);

    console.log('[Drive This] Map scroll enhancement initialized');
  }

  /**
   * Create and inject chevron buttons
   */
  function createChevrons(wrapper, container) {
    // Create a non-scrolling wrapper for the chevrons
    let chevronWrapper = wrapper.parentElement.querySelector('.dt-scroll-chevron-wrapper');
    if (!chevronWrapper) {
      // Ensure parent has relative positioning
      wrapper.parentElement.style.position = 'relative';
      
      chevronWrapper = document.createElement('div');
      chevronWrapper.className = 'dt-scroll-chevron-wrapper';
      wrapper.parentElement.appendChild(chevronWrapper);
    }

    const leftChevron = document.createElement('button');
    leftChevron.className = 'dt-scroll-chevron dt-scroll-left';
    leftChevron.innerHTML = CHEVRON_LEFT;
    leftChevron.setAttribute('aria-label', 'Scroll left');

    const rightChevron = document.createElement('button');
    rightChevron.className = 'dt-scroll-chevron dt-scroll-right';
    rightChevron.innerHTML = CHEVRON_RIGHT;
    rightChevron.setAttribute('aria-label', 'Scroll right');

    chevronWrapper.appendChild(leftChevron);
    chevronWrapper.appendChild(rightChevron);

    // Click handlers
    leftChevron.addEventListener('click', () => {
      container.scrollBy({ left: -CONFIG.scrollAmount, behavior: 'smooth' });
    });

    rightChevron.addEventListener('click', () => {
      container.scrollBy({ left: CONFIG.scrollAmount, behavior: 'smooth' });
    });

    return { left: leftChevron, right: rightChevron };
  }

  /**
   * Update chevron visibility based on scroll position
   */
  function updateChevrons(container, chevrons) {
    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    chevrons.left.classList.toggle('is-visible', scrollLeft > CONFIG.fadeThreshold);
    chevrons.right.classList.toggle('is-visible', scrollLeft < maxScroll - CONFIG.fadeThreshold);
  }

  /**
   * Setup scroll event listener with debounced chevron updates
   */
  function setupScrollListener(container, chevrons) {
    let ticking = false;

    container.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateChevrons(container, chevrons);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Also update on resize
    window.addEventListener('resize', () => updateChevrons(container, chevrons));

    // Initial check (with delays for CMS content loading)
    setTimeout(() => updateChevrons(container, chevrons), 100);
    setTimeout(() => updateChevrons(container, chevrons), 500);
    setTimeout(() => updateChevrons(container, chevrons), 1000);

    // Observer for dynamic content
    const observer = new MutationObserver(() => {
      setTimeout(() => updateChevrons(container, chevrons), 50);
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  /**
   * Setup drag-to-scroll functionality
   */
  function setupDragScroll(container) {
    let isDown = false;
    let startX;
    let scrollLeft;
    let hasMoved = false;

    container.addEventListener('mousedown', (e) => {
      // Don't interfere with links/buttons
      if (e.target.closest('a, button, .dt-scroll-chevron')) return;
      
      isDown = true;
      hasMoved = false;
      container.classList.add('is-dragging');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('mouseleave', () => {
      if (isDown) {
        isDown = false;
        container.classList.remove('is-dragging');
      }
    });

    container.addEventListener('mouseup', (e) => {
      const wasDragging = isDown && hasMoved;
      isDown = false;
      container.classList.remove('is-dragging');
      
      // Prevent click if we were dragging
      if (wasDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * CONFIG.dragMultiplier;
      
      // Only consider it a drag if moved more than 5px
      if (Math.abs(walk) > 5) {
        hasMoved = true;
        e.preventDefault();
        container.scrollLeft = scrollLeft - walk;
      }
    });

    // Prevent click events after drag
    container.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);
  }

  /**
   * Setup mouse wheel Y→X translation
   * Only triggers on vertical scroll, preserves native horizontal scrolling for trackpads
   */
  function setupWheelScroll(container) {
    container.addEventListener('wheel', (e) => {
      // Only convert Y to X if it's clearly a vertical scroll
      // Trackpads send deltaX for horizontal swipes
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaX === 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // === INITIALIZATION ===
  function init() {
    // Wait a bit for NoCodeFlow map to load
    setTimeout(initScrollEnhancement, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.DriveThisMapScroll = {
    reinit: initScrollEnhancement,
    config: CONFIG
  };

})();
