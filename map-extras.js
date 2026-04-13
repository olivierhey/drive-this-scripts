/**
 * Drive This – Map Extras
 * Version: 1.0.2
 *
 * Combines:
 *  - Transitions ready class
 *  - Heart / Favorite pins
 *  - Upcoming event badges
 *  - Favorites filter button
 *  - Past events filter
 *
 * v1.0.1 fix: reliable favorite pin sync
 *  - debouncedSync uses clearTimeout instead of early-return (was skipping mutations)
 *  - initFavoritePins retries sync at 500ms, 1s, 2s, 3.5s after init (NCF loads pins in waves)
 *  - .mapboxgl-map added as primary container selector
 *
 * v1.0.2: Past event next edition notice in drawer
 */

/* ── Transitions ── */
requestAnimationFrame(function(){requestAnimationFrame(function(){document.body.classList.add('dt-transitions-ready')})});

/* ── Demo Events Filter ── */
(function(){
  const DEMO_SLUGS = window.DT_DEMO_SLUGS || [];
  if (!DEMO_SLUGS.length) return;
  function hideDemoItems() {
    document.querySelectorAll('.cru-ncf-map-list-item').forEach(item => {
      if (DEMO_SLUGS.includes(item.dataset.slug || '')) item.style.display = 'none';
    });
    DEMO_SLUGS.forEach(slug => {
      document.querySelectorAll(`.ncf-slug-${slug}`).forEach(pin => {
        pin.style.display = 'none';
      });
    });
  }
  function init() {
    hideDemoItems();
    const lc = document.querySelector('.horizontal-scroll, .cru-ncf-map-list');
    if (lc) { const ob = new MutationObserver(() => { setTimeout(hideDemoItems, 100); }); ob.observe(lc, { childList: true, subtree: true }); }
    const mc = document.querySelector('.ncf-map-wrapper, .cru-ncf-map');
    if (mc) { const mo = new MutationObserver(() => { setTimeout(hideDemoItems, 100); }); mo.observe(mc, { childList: true, subtree: true }); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { setTimeout(init, 500); }); }
  else { setTimeout(init, 500); }
  window.Webflow && window.Webflow.push(() => { setTimeout(init, 500); });
})();

/* ── Heart Pins ── */
(function(){const heartPinDataUri='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C12 20 2 14.5909 2 8.21591C2 6.83256 2.54705 5.50588 3.52079 4.5277C4.49454 3.54953 5.81522 3 7.19231 3C9.36442 3 11.3 4.2 12 5.0C12.7 4.2 14.6356 3 16.8077 3C18.1848 3 19.5055 3.54953 20.4792 4.5277C21.453 5.50588 22 6.83256 22 8.21591C22 14.5909 12 20 12 20Z" fill="#2a2a3a" stroke="white" stroke-width="3"/></svg>');const originalPins=new Map();function getSlugFromPin(p){const c=p.className.split(' ');const s=c.find(x=>x.startsWith('ncf-slug-'));return s?s.replace('ncf-slug-',''):null}function updatePinAppearance(p,isFav,animate=false){const s=getSlugFromPin(p);if(!s)return;if(!originalPins.has(s)){originalPins.set(s,p.style.backgroundImage)}p.classList.remove('animate-favorite','animate-unfavorite','pulse-ring');if(isFav){if(animate){p.style.backgroundImage=`url("${heartPinDataUri}")`;p.classList.add('is-favorite-pin');void p.offsetWidth;p.classList.add('animate-favorite');const startTime=performance.now();const duration=600;function animateGlow(currentTime){const elapsed=currentTime-startTime;const progress=Math.min(elapsed/duration,1);let spread,opacity;if(progress<.5){spread=progress*16;opacity=.7-(progress*.6)}else{spread=8+((progress-.5)*16);opacity=.4-((progress-.5)*.8)}p.style.boxShadow=`0 0 0 ${spread}px rgba(255, 153, 0, ${opacity})`;if(progress<1){requestAnimationFrame(animateGlow)}else{p.style.boxShadow='';p.classList.remove('animate-favorite','pulse-ring')}}requestAnimationFrame(animateGlow)}else{p.style.backgroundImage=`url("${heartPinDataUri}")`;p.classList.add('is-favorite-pin')}}else{if(animate){p.classList.add('animate-unfavorite');setTimeout(()=>{p.style.backgroundImage=originalPins.get(s)||'';p.classList.remove('is-favorite-pin')},140);setTimeout(()=>{p.classList.remove('animate-unfavorite')},350)}else{p.style.backgroundImage=originalPins.get(s)||'';p.classList.remove('is-favorite-pin')}}}

/* FIX v1.0.1: clearTimeout instead of early-return */
let syncTimer=null;
function syncAllPinsWithFavorites(){const f=JSON.parse(localStorage.getItem('dt_favorites')||'[]');document.querySelectorAll('.cru-ncf-pin').forEach(p=>{const s=getSlugFromPin(p);if(s)updatePinAppearance(p,f.includes(s),false)})}
function debouncedSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncAllPinsWithFavorites,200)}

function updatePinBySlug(slug,isFav){document.querySelectorAll('.cru-ncf-pin').forEach(p=>{if(getSlugFromPin(p)===slug){updatePinAppearance(p,isFav,true)}})}window.addEventListener('dt:favorite-toggled',function(e){const{slug,isFavorited}=e.detail;updatePinBySlug(slug,isFavorited)});

/* FIX v1.0.1: retry syncs + mapboxgl-map selector */
function initFavoritePins(){const ch=setInterval(()=>{const pins=document.querySelectorAll('.cru-ncf-pin');if(pins.length>0){clearInterval(ch);syncAllPinsWithFavorites();[500,1000,2000,3500].forEach(d=>setTimeout(syncAllPinsWithFavorites,d));const mc=document.querySelector('.mapboxgl-map, .ncf-map-wrapper, .cru-ncf-map, [class*="mapbox"]');if(mc){const ob=new MutationObserver(()=>{debouncedSync()});ob.observe(mc,{childList:true,subtree:true})}}},300)}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initFavoritePins)}else{initFavoritePins()}})();

/* ── Upcoming Event Badges ── */
(function(){function highlightUpcomingEvents(){const eventCards=document.querySelectorAll('.cru-ncf-map-list-item');const today=new Date();today.setHours(0,0,0,0);const startOfWeek=new Date(today);const dayOfWeek=today.getDay();const daysToMonday=dayOfWeek===0?-6:1-dayOfWeek;startOfWeek.setDate(today.getDate()+daysToMonday);const endOfWeek=new Date(startOfWeek);endOfWeek.setDate(startOfWeek.getDate()+6);eventCards.forEach(card=>{const oldBadge=card.querySelector('.dt-upcoming-badge');if(oldBadge)oldBadge.remove();card.classList.remove('event-today','event-tomorrow','event-this-week','event-happening');const startDateStr=card.dataset.start;const endDateStr=card.dataset.end;if(!startDateStr)return;const startDate=new Date(startDateStr);startDate.setHours(0,0,0,0);const endDate=endDateStr?new Date(endDateStr):new Date(startDate);endDate.setHours(23,59,59,999);const isHappening=today>=startDate&&today<=endDate;const dayDiff=Math.floor((startDate-today)/(1000*60*60*24));let badgeText='';let badgeClass='';let cardClass='';if(isHappening){badgeText='Happening Now';badgeClass='badge-happening';cardClass='event-happening'}else if(dayDiff===0){badgeText='Today';badgeClass='badge-today';cardClass='event-today'}else if(dayDiff===1){badgeText='Tomorrow';badgeClass='badge-tomorrow';cardClass='event-tomorrow'}else if(startDate>=startOfWeek&&startDate<=endOfWeek&&endDate>=today){badgeText='This Week';badgeClass='badge-week';cardClass='event-this-week'}if(badgeText){card.classList.add(cardClass);const badge=document.createElement('div');badge.className=`dt-upcoming-badge ${badgeClass}`;badge.textContent=badgeText;card.style.position='relative';card.insertBefore(badge,card.firstChild)}})}function init(){highlightUpcomingEvents();const listContainer=document.querySelector('.horizontal-scroll, .cru-ncf-map-list');if(listContainer){const observer=new MutationObserver(()=>{setTimeout(highlightUpcomingEvents,100)});observer.observe(listContainer,{childList:true,subtree:true})}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}})();

/* ── Favorites Filter ── */
(function(){const heartSVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C12 20 2 14.5909 2 8.21591C2 6.83256 2.54705 5.50588 3.52079 4.5277C4.49454 3.54953 5.81522 3 7.19231 3C9.36442 3 11.3 4.2 12 5.0C12.7 4.2 14.6356 3 16.8077 3C18.1848 3 19.5055 3.54953 20.4792 4.5277C21.453 5.50588 22 6.83256 22 8.21591C22 14.5909 12 20 12 20Z" stroke="currentColor" stroke-width="2"/></svg>';let favoritesFilterActive=false;function getFavorites(){return JSON.parse(localStorage.getItem('dt_favorites')||'[]')}function getEventSlugFromCard(card){if(card.dataset.slug)return card.dataset.slug;const name=card.dataset.name||card.querySelector('h3')?.textContent||'';if(!name)return'';return name.toLowerCase().replace(/[äÄ]/g,'ae').replace(/[öÖ]/g,'oe').replace(/[üÜ]/g,'ue').replace(/[ß]/g,'ss').replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u').replace(/[îïì]/g,'i').replace(/[ôöò]/g,'o').replace(/[ñ]/g,'n').replace(/[ç]/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}function getSlugFromPin(pin){const classes=pin.className.split(' ');const slugClass=classes.find(c=>c.startsWith('ncf-slug-'));return slugClass?slugClass.replace('ncf-slug-',''):null}function applyFavoritesFilter(){const fav=getFavorites();const cards=document.querySelectorAll('.cru-ncf-map-list-item');const pins=document.querySelectorAll('.cru-ncf-pin');if(favoritesFilterActive){cards.forEach(card=>{const slug=getEventSlugFromCard(card);if(fav.includes(slug)){card.classList.remove('dt-filtered-out')}else{card.classList.add('dt-filtered-out')}});pins.forEach(pin=>{const slug=getSlugFromPin(pin);if(slug&&fav.includes(slug)){pin.classList.remove('dt-filtered-out')}else{pin.classList.add('dt-filtered-out')}})}else{cards.forEach(card=>{card.classList.remove('dt-filtered-out')});pins.forEach(pin=>{pin.classList.remove('dt-filtered-out')})}}function updateFavoritesCount(button){const countBadge=button.querySelector('.dt-favorites-count');if(countBadge){const count=getFavorites().length;countBadge.textContent=count;countBadge.style.display=count>0?'inline-flex':'none'}}function toggleFavoritesFilter(button){favoritesFilterActive=!favoritesFilterActive;button.classList.toggle('active',favoritesFilterActive);if(favoritesFilterActive){const otherFilters=document.querySelectorAll('.cru-ncf-map-filter:not(.dt-favorites-filter)');otherFilters.forEach(filter=>{filter.classList.remove('active');const checkbox=filter.querySelector('input[type="checkbox"]');if(checkbox&&checkbox.checked){checkbox.click()}})}applyFavoritesFilter();updateURLParameter()}function updateURLParameter(){const url=new URL(window.location);if(favoritesFilterActive){url.searchParams.set('favorites','1')}else{url.searchParams.delete('favorites')}window.history.pushState({},'',url)}function injectFavoritesButton(){const fw=document.querySelector('.ncf-filter-options-wrapper');if(!fw)return false;if(document.querySelector('.dt-favorites-filter'))return true;const button=document.createElement('div');button.className='dt-favorites-filter cru-ncf-map-filter';button.setAttribute('role','button');button.setAttribute('aria-label','Filter by favorites');button.innerHTML=`${heartSVG}<span>Favorites</span><span class="dt-favorites-count" style="display:none">0</span>`;button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggleFavoritesFilter(this)},true);button.addEventListener('mousedown',function(e){e.preventDefault();e.stopPropagation()},true);fw.insertBefore(button,fw.firstChild);updateFavoritesCount(button);return true}function setupFilterInterop(){document.addEventListener('click',function(e){const cf=e.target.closest('.cru-ncf-map-filter:not(.dt-favorites-filter)');if(cf&&favoritesFilterActive){const fb=document.querySelector('.dt-favorites-filter');if(fb){favoritesFilterActive=false;fb.classList.remove('active');applyFavoritesFilter()}}});const rb=document.querySelector('[data-action="reset-filter"], .reset-filter, [class*="reset"]');if(rb){rb.addEventListener('click',function(){const fb=document.querySelector('.dt-favorites-filter');if(fb&&favoritesFilterActive){favoritesFilterActive=false;fb.classList.remove('active');applyFavoritesFilter()}})}}window.addEventListener('dt:favorite-toggled',function(e){const b=document.querySelector('.dt-favorites-filter');if(b){updateFavoritesCount(b);if(favoritesFilterActive)applyFavoritesFilter()}});function checkURLOnLoad(){const u=new URLSearchParams(window.location.search);if(u.get('favorites')==='1'){const b=document.querySelector('.dt-favorites-filter');if(b)toggleFavoritesFilter(b)}}function init(){let attempts=0;const maxAttempts=20;const checkInterval=setInterval(()=>{attempts++;if(injectFavoritesButton()){clearInterval(checkInterval);setupFilterInterop();checkURLOnLoad()}else if(attempts>=maxAttempts){clearInterval(checkInterval)}},300)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}})();

/* ── Past Events Filter ── */
(function(){function filterPastEvents(){const today=new Date();today.setHours(0,0,0,0);document.querySelectorAll('.cru-ncf-map-list-item').forEach(item=>{const endDateStr=item.dataset.end||item.dataset.start;if(endDateStr){const endDate=new Date(endDateStr);endDate.setHours(23,59,59,999);if(endDate<today){item.style.display='none';const slug=item.dataset.slug||item.dataset.name?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(slug){document.querySelectorAll('.cru-ncf-pin').forEach(pin=>{const pc=pin.className.split(' ');const psc=pc.find(c=>c.startsWith('ncf-slug-'));if(psc){const ps=psc.replace('ncf-slug-','');if(ps===slug){pin.classList.add('is-past-event')}}})}}}})}function init(){filterPastEvents();const lc=document.querySelector('.horizontal-scroll, .cru-ncf-map-list');if(lc){const ob=new MutationObserver(()=>{setTimeout(filterPastEvents,100)});ob.observe(lc,{childList:true,subtree:true})}const mc=document.querySelector('.ncf-map-wrapper, .cru-ncf-map');if(mc){const mo=new MutationObserver(()=>{setTimeout(filterPastEvents,100)});mo.observe(mc,{childList:true,subtree:true})}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>{setTimeout(init,500)})}else{setTimeout(init,500)}window.Webflow&&window.Webflow.push(()=>{setTimeout(init,500)})})();

/* ── Past Event: Next Edition Notice ── */
(function(){
  const NOTICE_ID = 'dt-next-edition-notice';

  function injectNextEditionNotice() {
    const old = document.getElementById(NOTICE_ID);
    if (old) old.remove();

    const pastBadge = document.getElementById('dt-drawer-past-badge');
    if (!pastBadge || pastBadge.style.display === 'none') return;

    const dateBlock = document.getElementById('dt-drawer-date'); // ← fix
    if (!dateBlock) return;

    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0; font-size:0.9rem; color:inherit; opacity:0.3; padding-left:28px;';
    notice.textContent = 'Next edition: 2027 – Dates TBA';

    dateBlock.insertAdjacentElement('afterend', notice);
  }

  function init() {
    const drawer = document.getElementById('dt-drawer');
    if (!drawer) { setTimeout(init, 500); return; }

    const observer = new MutationObserver(() => {
      if (drawer.classList.contains('is-active')) {
        setTimeout(injectNextEditionNotice, 150);
      } else {
        const old = document.getElementById(NOTICE_ID);
        if (old) old.remove();
      }
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });

    // Drawer bereits offen beim Pageload (URL-Parameter)
    if (drawer.classList.contains('is-active')) {
      setTimeout(injectNextEditionNotice, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
