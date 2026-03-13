/**
 * Drive This – Category Icons on Event Cards
 * Version: 1.2.0
 */
(function () {
  'use strict';

  const ICONS = {
    'exhibitions': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M240,208H224V115.55a16,16,0,0,0-6.93-13.27L134.93,45.53a16,16,0,0,0-18.11.29L38.86,102.36A16,16,0,0,0,32,115.55V208H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM208,208H144V160a16,16,0,0,0-16-16H128a16,16,0,0,0-16,16v48H48V115.55l77.85-56.82L208,115.64Z"/></svg>`,
    'lifestyle':   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-30,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,30L78,178l19,51.62a15.92,15.92,0,0,0,30,0L146,178l51.62-19a15.92,15.92,0,0,0,0-30ZM136,163.13,128,186l-8-22.87L97.13,155,120,147l8-22.87L136,147l22.87,8ZM224,72l-13.33,4.67L206,90.67a8,8,0,0,1-15.08,0L186.67,76.67,172,72a8,8,0,0,1,0-15.08l14.67-4.59L191.08,38a8,8,0,0,1,15.08,0l4.59,14.33L224,56.92a8,8,0,0,1,0,15.08ZM152,32l-9.33,3.27L139.41,44a8,8,0,0,1-15.08,0l-3.27-8.73L112,32a8,8,0,0,1,0-15.08l9.06-3.27L124.33,4a8,8,0,0,1,15.08,0l3.27,8.65L152,16a8,8,0,0,1,0,15.08Z"/></svg>`,
    'meetups':     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1,0-16,24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.27,67.27,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM87.24,98a8,8,0,1,0-15.5,4A24,24,0,1,1,48,128a8,8,0,0,1,0-16,51.6,51.6,0,0,0-41.6,21.6,8,8,0,1,1-12.8-9.6A67.27,67.27,0,0,1,21,102.49,40,40,0,1,1,87.24,98Z"/></svg>`,
    'racing':      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm56-120a8,8,0,0,1-8,8h-4.29l-21.4,42.8A8,8,0,0,1,143.16,150l-15.16-22.73L113.16,150a8,8,0,0,1-7.15,4.43,7.91,7.91,0,0,1-3.57-.85L81,142H80a8,8,0,0,1,0-16h4.29l21.4-42.8A8,8,0,0,1,112.84,80l15.16,22.73L142.84,80a8,8,0,0,1,10.72-2.43L175,89.54A8,8,0,0,1,184,96Z"/></svg>`,
    'tours':       `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M237.43,170.6l-48-112a8,8,0,0,0-14.5-.4l-30.46,57.86L115.63,99.2a8,8,0,0,0-9.26,2L18.37,204.8A8,8,0,0,0,24,218c.29,0,.58,0,.87,0a8,8,0,0,0,5.9-2.59l83.44-92.47,29.56,17.72a8,8,0,0,0,10.44-2.56l25.82-45,38.54,89.92A8,8,0,0,0,226,188a8,8,0,0,0,11.43-17.4Z"/></svg>`,
  };

  const CSS = `
    .dt-category-icon {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      pointer-events: none;
      opacity: 0.5;
    }
    .dt-category-icon svg { display: block; width: 16px; height: 16px; }
  `;

  function buildSlugCategoryMap() {
    const map = {};
    document.querySelectorAll('.cru-ncf-pin').forEach(pin => {
      const classes = pin.className.split(' ');
      const slugClass = classes.find(c => c.startsWith('ncf-slug-'));
      const catClass  = classes.find(c => c.startsWith('ncf-category-'));
      if (!slugClass || !catClass) return;
      const slug = slugClass.replace('ncf-slug-', '');
      const cat  = catClass.replace('ncf-category-', '').split('__')[0].toLowerCase();
      map[slug] = cat;
    });
    return map;
  }

  function addIcons(slugCatMap) {
    document.querySelectorAll('.cru-ncf-map-list-item').forEach(card => {
      if (card.querySelector('.dt-category-icon')) return;
      const slug = card.dataset.slug?.trim();
      if (!slug) return;
      const category = slugCatMap[slug];
      if (!category || !ICONS[category]) return;
      const icon = document.createElement('div');
      icon.className = 'dt-category-icon';
      icon.innerHTML = ICONS[category];
      card.appendChild(icon);
    });
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const check = setInterval(() => {
      const pins = document.querySelectorAll('.cru-ncf-pin');
      if (pins.length === 0) return;
      clearInterval(check);
      const slugCatMap = buildSlugCategoryMap();
      addIcons(slugCatMap);

      const list = document.querySelector('.cru-ncf-map-list, .cru-ncf-map-items');
      if (list) {
        new MutationObserver(() => addIcons(slugCatMap)).observe(list, { childList: true, subtree: true });
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
