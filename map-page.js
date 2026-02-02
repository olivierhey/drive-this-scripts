/**
 * Drive This - Map Page Scroll Enhancement v1.2.0
 * Adds chevron navigation, drag-to-scroll, and wheel support for horizontal event list
 * NEW: 2-second delay before showing chevrons (waits for GSAP animation)
 */

(function() {
  'use strict';

  const CONFIG = {
    scrollAmount: 320,
    fadeThreshold: 20,
    dragMultiplier: 1.5,
    chevronDelay: 2000, // 2 second delay before showing chevrons
    selectors: {
      list: '.cru-ncf-map-item-list',
      wrapper: '.horizontal-scroll'
    }
  };

  // SVG icons for chevrons
  const ICONS = {
    left: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    right: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>'
  };

  let scrollContainer = null;
  let chevrons = { left: null, right: null };
  let chevronsReady = false;

  /**
   * Create chevron buttons
   */
  function createChevrons(positionParent) {
    // Create wrapper for chevrons
    const wrapper = document.createElement('div');
    wrapper.className = 'dt-scroll-chevron-wrapper';

    // Left chevron
    const leftBtn = document.createElement('button');
    leftBtn.className = 'dt-scroll-chevron dt-scroll-chevron-left';
    leftBtn.setAttribute('aria-label', 'Scroll left');
    leftBtn.innerHTML = ICONS.left;

    // Right chevron
    const rightBtn = document.createElement('button');
    rightBtn.className = 'dt-scroll-chevron dt-scroll-chevron-right';
    rightBtn.setAttribute('aria-label', 'Scroll right');
    rightBtn.innerHTML = ICONS.right;

    wrapper.appendChild(leftBtn);
    wrapper.appendChild(rightBtn);

    // Insert wrapper as sibling, positioned relative to parent
    const parentStyle = window.getComputedStyle(positionParent);
    if (parentStyle.position === 'static') {
      positionParent.style.position = 'relative';
    }
    positionParent.appendChild(wrapper);

    return { left: leftBtn, right: rightBtn };
  }

  /**
   * Update chevron visibility based on scroll position
   */
  function updateChevrons(container, chevs) {
    if (!container || !chevs.left || !chevs.right) return;

    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    // Show/hide based on scroll position (actual display controlled by CSS + dt-chevrons-ready)
    const showLeft = scrollLeft > CONFIG.fadeThreshold;
    const showRight = scrollLeft < maxScroll - CONFIG.fadeThreshold;

    chevs.left.classList.toggle('is-visible', showLeft);
    chevs.right.classList.toggle('is-visible', showRight);
  }

  /**
   * Smooth scroll by amount
   */
  function smoothScroll(container, amount) {
    const start = container.scrollLeft;
    const duration = 300;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      container.scrollLeft = start + (amount * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
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
      // Don't interfere with links, buttons, or chevrons
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
      if (isDown && hasMoved) {
        e.preventDefault();
      }
      isDown = false;
      container.classList.remove('is-dragging');
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * CONFIG.dragMultiplier;
      
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
   * Setup horizontal wheel scrolling
   */
  function setupWheelScroll(container) {
    container.addEventListener('wheel', (e) => {
      // Only handle vertical wheel events
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  /**
   * Initialize everything
   */
  function init() {
    const wrapper = document.querySelector(CONFIG.selectors.wrapper);
    const list = document.querySelector(CONFIG.selectors.list);
    
    if (!wrapper || !list) {
      // Retry if elements not found yet
      setTimeout(init, 500);
      return;
    }

    scrollContainer = wrapper;

    // Create chevrons
    chevrons = createChevrons(wrapper.parentElement || wrapper);

    // Setup click handlers for chevrons
    chevrons.left.addEventListener('click', () => {
      smoothScroll(scrollContainer, -CONFIG.scrollAmount);
    });

    chevrons.right.addEventListener('click', () => {
      smoothScroll(scrollContainer, CONFIG.scrollAmount);
    });

    // Setup scroll listener for chevron visibility
    scrollContainer.addEventListener('scroll', () => {
      updateChevrons(scrollContainer, chevrons);
    });

    // Setup drag and wheel scroll
    setupDragScroll(scrollContainer);
    setupWheelScroll(scrollContainer);

    // Initial chevron update
    updateChevrons(scrollContainer, chevrons);

    // DELAY: Wait 2 seconds before enabling chevrons (allows GSAP animation to complete)
    setTimeout(() => {
      chevronsReady = true;
      chevrons.left.classList.add('dt-chevrons-ready');
      chevrons.right.classList.add('dt-chevrons-ready');
      // Re-check visibility now that they're ready
      updateChevrons(scrollContainer, chevrons);
    }, CONFIG.chevronDelay);

    // Handle window resize
    window.addEventListener('resize', () => {
      updateChevrons(scrollContainer, chevrons);
    });

    console.log('Drive This Map Page Scroll v1.2.0 initialized (chevron delay: ' + CONFIG.chevronDelay + 'ms)');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
