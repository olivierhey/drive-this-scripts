/**
 * Drive This – Category Icons on Event Cards
 * Version: 1.5.0
 */
(function () {
  'use strict';

  const ICONS = {
    'exhibitions': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path d="M136,216V32a8,8,0,0,0-12.44-6.65l-80,53.33A8,8,0,0,0,40,85.35V216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M136,88h72a8,8,0,0,1,8,8V216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="16" y1="216" x2="240" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="112" x2="104" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="72" y1="112" x2="72" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="72" y1="168" x2="72" y2="184" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="168" x2="104" y2="184" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
    'lifestyle':   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path d="M84.27,171.73l-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3a7.92,7.92,0,0,1,0,14.86l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="176" y1="16" x2="176" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="224" y1="72" x2="224" y2="104" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="152" y1="40" x2="200" y2="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="208" y1="88" x2="240" y2="88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
    'meetups':     `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path d="M192,120a59.91,59.91,0,0,1,48,24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M16,144a59.91,59.91,0,0,1,48-24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="144" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M72,216a65,65,0,0,1,112,0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M161,80a32,32,0,1,1,31,40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M64,120A32,32,0,1,1,95,80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
    'racing':      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path d="M48,176c64-55.43,112,55.43,176,0V56C160,111.43,112,.57,48,56V224" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M48,116c64-55.43,112,55.43,176,0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="168" y1="69.48" x2="168" y2="189.48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="42.52" x2="104" y2="162.52" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
    'tours':       `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><circle cx="164" cy="52" r="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M8,200,81.1,75.94a8,8,0,0,1,13.8,0L168,200Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="50.35" y1="128" x2="125.65" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M146.61,163.71l33.06-55.79a8,8,0,0,1,13.76,0L248,200H168" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
  };

  const CSS = `
    .dt-category-icon {
      position: absolute;
      top: 14px;
      left: 18px;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      pointer-events: none;
      opacity: 1;
      z-index: 10;
    }
    .dt-category-icon svg { display: block; width: 18px; height: 18px; }
  `;

  let slugCatMap = {};

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

  function addIcons() {
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

    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      const pins  = document.querySelectorAll('.cru-ncf-pin');
      const cards = document.querySelectorAll('.cru-ncf-map-list-item');
      if (pins.length === 0 || cards.length === 0) return;

      if (Object.keys(slugCatMap).length === 0) {
        slugCatMap = buildSlugCategoryMap();
      }

      addIcons();
      if (attempts >= 20) clearInterval(check);
    }, 500);

    new MutationObserver(() => {
      if (Object.keys(slugCatMap).length === 0) return;
      addIcons();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
