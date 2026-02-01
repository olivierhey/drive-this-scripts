/**
 * DRIVE THIS - Event Page Scripts
 * Version: 1.0.3
 */

// Global guard - prevent entire script from running twice
if (window.DriveThisLoaded) {
  console.log('[Drive This] Already loaded, skipping');
} else {
  window.DriveThisLoaded = true;

(function() {
  'use strict';

  // ===========================================
  // UTILITIES
  // ===========================================
  
  const DT = {
    slug: window.location.pathname.split('/').filter(Boolean).pop(),
    
    onReady(fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        fn();
      }
    },

    log(msg) {
      console.log(`[Drive This] ${msg}`);
    }
  };

  // ===========================================
  // FAVORITES SYSTEM
  // ===========================================
  
  const Favorites = {
    STORAGE_KEY: 'dt_favorites',

    getAll() {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    },

    isFavorited(slug) {
      return this.getAll().includes(slug);
    },

    toggle(slug) {
      let favorites = this.getAll();
      const isFav = favorites.includes(slug);
      
      if (isFav) {
        favorites = favorites.filter(f => f !== slug);
      } else {
        favorites.push(slug);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
      
      window.dispatchEvent(new CustomEvent('dt:favorite-toggled', {
        detail: { slug, isFavorited: !isFav }
      }));
      
      return !isFav;
    },

    updateButton(btn, isFav) {
      btn.classList.toggle('is-favorited', isFav);
      
      const path = btn.querySelector('svg path');
      if (path) {
        path.setAttribute('fill', isFav ? 'currentColor' : 'none');
      }
      
      const text = btn.querySelector('.dt-favorite-text');
      if (text) {
        text.textContent = isFav ? 'Saved' : 'Save Event';
      }
      
      btn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    },

    init() {
      const btn = document.getElementById('dt-event-favorite');
      if (!btn || !DT.slug) return;

      this.updateButton(btn, this.isFavorited(DT.slug));

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isNowFav = this.toggle(DT.slug);
        this.updateButton(btn, isNowFav);
        
        btn.classList.remove('just-toggled');
        void btn.offsetWidth;
        btn.classList.add('just-toggled');
        
        DT.log('Favorite toggled: ' + isNowFav);
      });

      DT.log('Favorites initialized');
    }
  };

  // ===========================================
  // PAST EVENT BADGE
  // ===========================================
  
  const PastEvent = {
    init() {
      const endDateEl = document.querySelector('[data-event-end]');
      const startDateEl = document.querySelector('[data-event-start]');
      
      // Get the actual date string, preferring end date if it has a value
      const endDateStr = endDateEl ? endDateEl.getAttribute('data-event-end') : '';
      const startDateStr = startDateEl ? startDateEl.getAttribute('data-event-start') : '';
      
      // Use end date if it has a value, otherwise fall back to start date
      const dateStr = endDateStr || startDateStr;
      if (!dateStr || dateStr.includes('{{')) return;

      const endDate = new Date(dateStr);
      endDate.setHours(23, 59, 59, 999);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (endDate >= today) return;

      const container = document.querySelector('.meta-date');
      if (!container) return;

      if (!document.querySelector('.dt-past-event-badge-detail')) {
        const badge = document.createElement('span');
        badge.className = 'dt-past-event-badge-detail';
        badge.textContent = 'Past Event';
        container.insertBefore(badge, container.firstChild);
      }

      Array.from(container.children).forEach(child => {
        if (!child.classList.contains('dt-past-event-badge-detail')) {
          child.style.textDecoration = 'line-through';
        }
      });

      DT.log('Past event badge added');
    }
  };

  // ===========================================
  // EVENT CARD LINKS
  // ===========================================
  
  const CardLinks = {
    init() {
      const cards = document.querySelectorAll('[data-slug]');
      
      cards.forEach(card => {
        const slug = card.getAttribute('data-slug');
        if (!slug) return;

        if (card.tagName === 'A') {
          card.href = `/events/${slug}`;
        } else {
          card.style.cursor = 'pointer';
          card.addEventListener('click', (e) => {
            if (e.target.closest('#dt-event-favorite, .dt-favorite-pin')) return;
            window.location.href = `/events/${slug}`;
          });
        }
      });

      if (cards.length) DT.log(`Fixed ${cards.length} event card links`);
    }
  };

  // ===========================================
  // LIGHTBOX (for Featured Event pages)
  // ===========================================
  
  const Lightbox = {
    overlay: null,
    img: null,

    create() {
      if (this.overlay) return;

      this.overlay = document.createElement('div');
      this.overlay.className = 'dt-lightbox';
      this.overlay.innerHTML = '<img src="" alt="Enlarged view">';
      this.img = this.overlay.querySelector('img');

      this.overlay.addEventListener('click', () => this.close());
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });

      document.body.appendChild(this.overlay);
    },

    open(src) {
      this.create();
      this.img.src = src;
      this.overlay.classList.add('is-active');
      document.body.style.overflow = 'hidden';
    },

    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('is-active');
      document.body.style.overflow = '';
    },

    init() {
      const images = document.querySelectorAll('[data-lightbox]');
      if (!images.length) return;

      images.forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
          this.open(img.src);
        });
      });

      DT.log(`Lightbox initialized for ${images.length} images`);
    }
  };

  // ===========================================
  // VIDEO EMBED (for Featured Event pages)
  // ===========================================
  
  const VideoEmbed = {
    getYouTubeId(url) {
      const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^"&?\/\s]{11})/);
      return match ? match[1] : null;
    },

    getVimeoId(url) {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? match[1] : null;
    },

    init() {
      const containers = document.querySelectorAll('[data-video-url]');
      if (!containers.length) return;

      containers.forEach(container => {
        const url = container.getAttribute('data-video-url');
        if (!url) return;

        let embedUrl = '';
        const ytId = this.getYouTubeId(url);
        const vimeoId = this.getVimeoId(url);

        if (ytId) {
          embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0`;
        } else if (vimeoId) {
          embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
        }

        if (embedUrl) {
          container.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;"></iframe>`;
          container.style.position = 'relative';
          container.style.paddingBottom = '56.25%';
          container.style.height = '0';
        }
      });

      DT.log('Video embeds initialized');
    }
  };

  // ===========================================
  // DEALS SECTION (for Featured Event pages)
  // ===========================================
  
  const Deals = {
    init() {
      const codeElements = document.querySelectorAll('[data-copy-code]');
      
      codeElements.forEach(el => {
        el.style.cursor = 'pointer';
        el.title = 'Click to copy';
        
        el.addEventListener('click', () => {
          const code = el.getAttribute('data-copy-code') || el.textContent;
          navigator.clipboard.writeText(code).then(() => {
            const original = el.textContent;
            el.textContent = 'Copied!';
            setTimeout(() => {
              el.textContent = original;
            }, 1500);
          });
        });
      });

      if (codeElements.length) DT.log('Deal codes initialized');
    }
  };

  // ===========================================
  // INITIALIZE ALL
  // ===========================================
  
  DT.onReady(() => {
    Favorites.init();
    PastEvent.init();
    CardLinks.init();
    Lightbox.init();
    VideoEmbed.init();
    Deals.init();
    
    DT.log('All modules ready');
  });

  // Expose for debugging
  window.DriveThis = { DT, Favorites, Lightbox };

})();

} // end of global guard
