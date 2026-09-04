/**
 * DRIVE THIS - Event Page Scripts
 * Version: 1.5.0 (2026-09-04)
 * Save button: heart -> bookmark. The button holds an outline and a filled
 * SVG, event-page.css switches them via .is-favorited; the script only
 * toggles the class and the labels. Storage key dt_favorites unchanged.
 * 1.4.0: Weather widget now shows for ongoing events (uses end date)
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
      btn.setAttribute('aria-label', isFav ? 'Remove from saved events' : 'Save event');
      btn.setAttribute('title', isFav ? 'Saved event' : 'Save event');
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
        
        DT.log('Saved event toggled: ' + isNowFav);
      });

      DT.log('Save button initialized');
    }
  };

  // ===========================================
  // PAST EVENT BADGE
  // ===========================================
  
  const PastEvent = {
    init() {
      const readDateAttr = (sel, attr) => {
        const el = document.querySelector(sel);
        const v = el ? el.getAttribute(attr) : '';
        return (!v || v.includes('{{')) ? '' : v.trim();
      };

      // End date if set, otherwise fall back to start date (single-day events)
      const refStr = readDateAttr('[data-event-end]', 'data-event-end')
                  || readDateAttr('[data-event-start]', 'data-event-start');
      if (!refStr) return;

      const refDate = new Date(refStr);
      if (isNaN(refDate)) return;
      refDate.setHours(23, 59, 59, 999);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (refDate >= today) return;

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
          embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`;
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
  // WEATHER WIDGET
  // Read data-lat, data-lng, data-date, data-end from #dt-event-weather-trigger
  // Renders into #dt-page-weather
  // v1.4.0 FIX: Shows weather for ongoing events; falls back to start date
  //             if no end date (single-day events)
  // ===========================================

  const Weather = {
    API_KEY: 'e5472fae42c64a6f3aae2820d281c8b9',

    icons: {
      sun: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b21c3c8fef0fee1f6d3a2_sun.svg',
      moon: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22026f960232a5ee2b6b_moon.svg',
      'sun-cloud': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b225475549a09cf3b7ced_sun-cloud.svg',
      'moon-cloud': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b225a31bcf1568b3ab447_moon-cloud.svg',
      cloud: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22900f79853fb27e734d_cloud.svg',
      clouds: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22ccca25ab23b4fac45f_clouds.svg',
      rain: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22edf8b5965f7dae4770_rain.svg',
      'sun-rain': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b2505122b568fa8a400d1_sun-rain.svg',
      'moon-rain': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b25ab816fa5375bb8d16d_moon-rain.svg',
      storm: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b25ec30d703bac4ed9167_storm.svg',
      snow: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b2611704de73bf8fca88c_snow.svg',
      fog: 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b27035b7e873366cebd4e_fog.svg',
    },

    iconMap: {
      '01d':'sun','02d':'sun-cloud','03d':'cloud','04d':'clouds',
      '09d':'rain','10d':'sun-rain','11d':'storm','13d':'snow','50d':'fog',
      '01n':'moon','02n':'moon-cloud','03n':'cloud','04n':'clouds',
      '09n':'rain','10n':'moon-rain','11n':'storm','13n':'snow','50n':'fog',
    },

    wmoToIcon(c) {
      if (c <= 1) return 'sun';
      if (c === 2) return 'sun-cloud';
      if (c === 3) return 'clouds';
      if (c >= 45 && c <= 48) return 'fog';
      if (c >= 51 && c <= 67) return 'rain';
      if (c >= 71 && c <= 77) return 'snow';
      if (c >= 80 && c <= 82) return 'sun-rain';
      if (c >= 95) return 'storm';
      return 'sun';
    },

    render(iconKey, temp, historical) {
      const container = document.getElementById('dt-page-weather');
      if (!container) return;

      const iconUrl = this.icons[iconKey] || this.icons['cloud'];
      const label = historical ? 'Typical for this date' : 'Weather forecast';

      container.innerHTML = `
        <div class="dt-page-weather-inner">
          <img class="dt-page-weather-icon" src="${iconUrl}" alt="Weather">
          <span class="dt-page-weather-temp">${temp}°C</span>
          <span class="dt-page-weather-label">${label}</span>
        </div>`;

      DT.log(`Weather rendered: ${temp}°C (${label})`);
    },

    async fetchForecast(lat, lng, daysAhead) {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${this.API_KEY}`
      );
      if (!r.ok) throw new Error('Forecast API error: ' + r.status);
      const d = await r.json();

      const target = new Date();
      target.setDate(target.getDate() + daysAhead);
      target.setHours(12, 0, 0, 0);

      let best = null, minDiff = Infinity;
      for (const item of d.list) {
        const diff = Math.abs(new Date(item.dt * 1000) - target);
        if (diff < minDiff) { minDiff = diff; best = item; }
      }
      if (!best) return;

      const iconKey = this.iconMap[best.weather[0].icon] || 'cloud';
      this.render(iconKey, Math.round(best.main.temp), false);
    },

    async fetchHistorical(lat, lng, eventDate) {
      const m = eventDate.getMonth();
      const dy = eventDate.getDate();
      const cy = new Date().getFullYear();
      const p = n => String(n).padStart(2, '0');
      const md = `${p(m + 1)}-${p(dy)}`;

      const r = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
        `&start_date=${cy - 3}-${md}&end_date=${cy - 1}-${md}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
      );
      if (!r.ok) return;
      const d = await r.json();
      if (!d.daily?.temperature_2m_max) return;

      const exactDates = [cy - 1, cy - 2, cy - 3].map(y => `${y}-${md}`);
      let ts = 0, ct = 0, wcs = [];
      d.daily.time.forEach((t, i) => {
        if (!exactDates.includes(t)) return;
        const avg = (d.daily.temperature_2m_max[i] + d.daily.temperature_2m_min[i]) / 2;
        if (!isNaN(avg)) { ts += avg; ct++; }
        if (d.daily.weathercode?.[i] != null) wcs.push(d.daily.weathercode[i]);
      });
      if (!ct) return;

      const mc = wcs.sort((a, b) =>
        wcs.filter(v => v === b).length - wcs.filter(v => v === a).length
      )[0];

      this.render(this.wmoToIcon(mc), Math.round(ts / ct), true);
    },

    async init() {
      const trigger = document.getElementById('dt-event-weather-trigger');
      if (!trigger) return;

      const lat = trigger.dataset.lat;
      const lng = trigger.dataset.lng;
      const date = trigger.dataset.date;
      const endDate = trigger.dataset.end; // may be empty for single-day events

      if (!lat || !lng || !date || date.includes('{')) return;

      const eventStart = new Date(date);
      const now = new Date();

      // Use end date if available, otherwise fall back to start date (single-day event)
      const eventEnd = (endDate && !endDate.includes('{'))
        ? new Date(endDate)
        : new Date(eventStart);
      eventEnd.setHours(23, 59, 59, 999);

      // Only hide weather once the event is completely over
      if (eventEnd < now) return;

      // For ongoing events daysAhead is 0, which fetches today's live forecast
      const daysAhead = Math.max(0, Math.ceil((eventStart - now) / 864e5));

      try {
        if (daysAhead <= 5) {
          await this.fetchForecast(lat, lng, daysAhead);
        } else {
          await this.fetchHistorical(lat, lng, eventStart);
        }
      } catch (e) {
        DT.log('Weather error: ' + e.message);
      }
    }
  };

  // ===========================================
  // DATE DISPLAY
  // Combines start, dash and end date into one line
  // ===========================================

  const DateDisplay = {
    init() {
      const start = document.querySelector('.sidebar-info-date');
      const dash = document.querySelector('.date-bis');
      const end = document.querySelector('.sidebar-info-date-end');
      if (!start) return;

      const parent = start.parentElement;

      // Rescue badge before clearing innerHTML
      const badge = parent.querySelector('.dt-past-event-badge-detail');

      const startText = start.textContent.trim();
      const endText = end ? end.textContent.trim() : '';
      // Only show dash if there is an actual end date different from start
      const dashText = (end && endText && endText !== startText) ? (dash ? dash.textContent.trim() : '–') : '';

      const combined = document.createElement('div');
      combined.textContent = [startText, dashText, endText].filter(Boolean).join(' ');
      combined.style.cssText = 'color:inherit;font-size:inherit;font-weight:inherit;';

      parent.innerHTML = '';
      if (badge) parent.appendChild(badge);
      parent.appendChild(combined);

      DT.log('Date display combined');
    }
  };

  // ===========================================
  // INITIALIZE ALL
  // ===========================================
  
  DT.onReady(() => {
    Favorites.init();
    PastEvent.init();
    DateDisplay.init();
    CardLinks.init();
    Lightbox.init();
    VideoEmbed.init();
    Deals.init();
    Weather.init();
    
    DT.log('All modules ready');
  });

  // Expose for debugging
  window.DriveThis = { DT, Favorites, Lightbox, Weather, DateDisplay };

})();

} // end of global guard
