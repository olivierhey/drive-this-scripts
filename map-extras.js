/**
 * Drive This – Map Extras
 * Version: 2.0.0 (2026-09-04)
 *
 * Combines:
 *  - Transitions ready class
 *  - Saved pins (bookmark marker on the country-ring pin)
 *  - Upcoming event badges
 *  - Saved filter button
 *  - Past events filter
 *  - Past event next edition notice in drawer
 *
 * v2.0.0: Favorites -> Saved events
 *  - Heart pins removed. A saved pin keeps its country ring and only gets the
 *    class .is-favorite-pin; the bookmark in the top-right corner is a CSS
 *    pseudo-element (map-inline.css). No inline background swap any more.
 *  - Filter chip: bookmark icon, label "Saved". URL param written as ?saved=1,
 *    ?favorites=1 is still accepted on load.
 *  - localStorage key (dt_favorites) and the dt:favorite-toggled event are
 *    unchanged so existing saved events survive the rename.
 *
 * v1.0.1 - v1.0.4: see git history (favorite pin sync, upcoming badge loop fix).
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

/* ── Saved Pins ── */
(function(){
  function getSlugFromPin(p){const c=p.className.split(' ');const s=c.find(x=>x.startsWith('ncf-slug-'));return s?s.replace('ncf-slug-',''):null}
  function setPin(p,isSaved,animate){
    const was=p.classList.contains('is-favorite-pin');
    if(isSaved){
      p.classList.add('is-favorite-pin');
      if(animate&&!was){p.classList.remove('animate-unfavorite','animate-favorite');void p.offsetWidth;p.classList.add('animate-favorite');setTimeout(()=>p.classList.remove('animate-favorite'),700)}
    }else{
      p.classList.remove('is-favorite-pin');
      if(animate&&was){p.classList.remove('animate-favorite');p.classList.add('animate-unfavorite');setTimeout(()=>p.classList.remove('animate-unfavorite'),300)}
    }
  }
  let syncTimer=null;
  function syncAllPinsWithFavorites(){const f=JSON.parse(localStorage.getItem('dt_favorites')||'[]');document.querySelectorAll('.cru-ncf-pin').forEach(p=>{const s=getSlugFromPin(p);if(s)setPin(p,f.includes(s),false)})}
  function debouncedSync(){clearTimeout(syncTimer);syncTimer=setTimeout(syncAllPinsWithFavorites,200)}
  function updatePinBySlug(slug,isSaved){document.querySelectorAll('.cru-ncf-pin').forEach(p=>{if(getSlugFromPin(p)===slug)setPin(p,isSaved,true)})}
  window.addEventListener('dt:favorite-toggled',function(e){const{slug,isFavorited}=e.detail;updatePinBySlug(slug,isFavorited)});
  function initSavedPins(){const ch=setInterval(()=>{const pins=document.querySelectorAll('.cru-ncf-pin');if(pins.length>0){clearInterval(ch);syncAllPinsWithFavorites();[500,1000,2000,3500].forEach(d=>setTimeout(syncAllPinsWithFavorites,d));const mc=document.querySelector('.mapboxgl-map, .ncf-map-wrapper, .cru-ncf-map, [class*="mapbox"]');if(mc){const ob=new MutationObserver(()=>{debouncedSync()});ob.observe(mc,{childList:true,subtree:true})}}},300)}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initSavedPins)}else{initSavedPins()}
})();

/* ── Upcoming Event Badges ── */
(function(){
  function highlightUpcomingEvents(){
    const eventCards=document.querySelectorAll('.cru-ncf-map-list-item');
    const today=new Date();today.setHours(0,0,0,0);
    const startOfWeek=new Date(today);
    const dayOfWeek=today.getDay();
    const daysToMonday=dayOfWeek===0?-6:1-dayOfWeek;
    startOfWeek.setDate(today.getDate()+daysToMonday);
    const endOfWeek=new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate()+6);
    eventCards.forEach(card=>{
      const oldBadge=card.querySelector('.dt-upcoming-badge');
      if(oldBadge)oldBadge.remove();
      card.classList.remove('event-today','event-tomorrow','event-this-week','event-happening');
      const startDateStr=card.dataset.start;
      const endDateStr=card.dataset.end;
      if(!startDateStr)return;
      const startDate=new Date(startDateStr);startDate.setHours(0,0,0,0);
      const endDate=endDateStr?new Date(endDateStr):new Date(startDate);
      endDate.setHours(23,59,59,999);
      const isHappening=today>=startDate&&today<=endDate;
      const dayDiff=Math.floor((startDate-today)/(1000*60*60*24));
      let badgeText='';let badgeClass='';let cardClass='';
      if(isHappening){badgeText='Happening Now';badgeClass='badge-happening';cardClass='event-happening'}
      else if(dayDiff===0){badgeText='Today';badgeClass='badge-today';cardClass='event-today'}
      else if(dayDiff===1){badgeText='Tomorrow';badgeClass='badge-tomorrow';cardClass='event-tomorrow'}
      else if(startDate>=startOfWeek&&startDate<=endOfWeek&&endDate>=today){badgeText='This Week';badgeClass='badge-week';cardClass='event-this-week'}
      if(badgeText){
        card.classList.add(cardClass);
        const badge=document.createElement('div');
        badge.className=`dt-upcoming-badge ${badgeClass}`;
        badge.textContent=badgeText;
        card.style.position='relative';
        card.insertBefore(badge,card.firstChild)
      }
    })
  }

  /* FIX v1.0.4: disconnect observer while we mutate, reconnect after.
     Our own badge inserts/removes are never recorded -> no loop.
     highlightUpcomingEvents() is synchronous, so no NCF mutation is lost. */
  let observer=null;
  let debounceTimer=null;
  let initialized=false;

  function runHighlight(){
    const listContainer=document.querySelector('.horizontal-scroll, .cru-ncf-map-list');
    if(observer)observer.disconnect();
    highlightUpcomingEvents();
    if(observer&&listContainer)observer.observe(listContainer,{childList:true,subtree:true});
  }

  function init(){
    if(initialized)return;
    initialized=true;
    observer=new MutationObserver(()=>{
      clearTimeout(debounceTimer);
      debounceTimer=setTimeout(runHighlight,150)
    });
    runHighlight();
    // Catch NCF load waves
    [500,1000,2000,3500].forEach(d=>setTimeout(runHighlight,d));
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>setTimeout(init,500))}
  else{setTimeout(init,500)}
  window.Webflow&&window.Webflow.push(()=>setTimeout(init,500));
})();

/* ── Saved Filter ── */
(function(){const LABEL='Saved';const bookmarkSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17.25 3H6.75C6.35218 3 5.97064 3.15804 5.68934 3.43934C5.40804 3.72064 5.25 4.10218 5.25 4.5V21C5.25007 21.1338 5.28595 21.2652 5.35393 21.3805C5.42191 21.4958 5.5195 21.5908 5.63659 21.6557C5.75367 21.7206 5.88598 21.7529 6.01978 21.7494C6.15358 21.7458 6.284 21.7066 6.3975 21.6356L12 18.1341L17.6034 21.6356C17.7169 21.7063 17.8472 21.7454 17.9809 21.7488C18.1146 21.7522 18.2467 21.7198 18.3636 21.655C18.4806 21.5902 18.5781 21.4953 18.646 21.3801C18.7139 21.2649 18.7498 21.1337 18.75 21V4.5C18.75 4.10218 18.592 3.72064 18.3107 3.43934C18.0294 3.15804 17.6478 3 17.25 3Z" fill="currentColor"/></svg>';let favoritesFilterActive=false;function getFavorites(){return JSON.parse(localStorage.getItem('dt_favorites')||'[]')}function getEventSlugFromCard(card){if(card.dataset.slug)return card.dataset.slug;const name=card.dataset.name||card.querySelector('h3')?.textContent||'';if(!name)return'';return name.toLowerCase().replace(/[äÄ]/g,'ae').replace(/[öÖ]/g,'oe').replace(/[üÜ]/g,'ue').replace(/[ß]/g,'ss').replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u').replace(/[îïì]/g,'i').replace(/[ôöò]/g,'o').replace(/[ñ]/g,'n').replace(/[ç]/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}function getSlugFromPin(pin){const classes=pin.className.split(' ');const slugClass=classes.find(c=>c.startsWith('ncf-slug-'));return slugClass?slugClass.replace('ncf-slug-',''):null}function applyFavoritesFilter(){const fav=getFavorites();const cards=document.querySelectorAll('.cru-ncf-map-list-item');const pins=document.querySelectorAll('.cru-ncf-pin');if(favoritesFilterActive){cards.forEach(card=>{const slug=getEventSlugFromCard(card);if(fav.includes(slug)){card.classList.remove('dt-filtered-out')}else{card.classList.add('dt-filtered-out')}});pins.forEach(pin=>{const slug=getSlugFromPin(pin);if(slug&&fav.includes(slug)){pin.classList.remove('dt-filtered-out')}else{pin.classList.add('dt-filtered-out')}})}else{cards.forEach(card=>{card.classList.remove('dt-filtered-out')});pins.forEach(pin=>{pin.classList.remove('dt-filtered-out')})}}function updateFavoritesCount(button){const countBadge=button.querySelector('.dt-favorites-count');if(countBadge){const count=getFavorites().length;countBadge.textContent=count;countBadge.style.display=count>0?'inline-flex':'none'}}function toggleFavoritesFilter(button){favoritesFilterActive=!favoritesFilterActive;button.classList.toggle('active',favoritesFilterActive);if(favoritesFilterActive){const otherFilters=document.querySelectorAll('.cru-ncf-map-filter:not(.dt-favorites-filter)');otherFilters.forEach(filter=>{filter.classList.remove('active');const checkbox=filter.querySelector('input[type="checkbox"]');if(checkbox&&checkbox.checked){checkbox.click()}})}applyFavoritesFilter();updateURLParameter()}function updateURLParameter(){const url=new URL(window.location);if(favoritesFilterActive){url.searchParams.set('saved','1')}else{url.searchParams.delete('saved');url.searchParams.delete('favorites')}window.history.pushState({},'',url)}function injectFavoritesButton(){const fw=document.querySelector('.ncf-filter-options-wrapper');if(!fw)return false;if(document.querySelector('.dt-favorites-filter'))return true;const button=document.createElement('div');button.className='dt-favorites-filter cru-ncf-map-filter';button.setAttribute('role','button');button.setAttribute('aria-label','Show saved events only');button.innerHTML=`${bookmarkSVG}<span>${LABEL}</span><span class="dt-favorites-count" style="display:none">0</span>`;button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggleFavoritesFilter(this)},true);button.addEventListener('mousedown',function(e){e.preventDefault();e.stopPropagation()},true);fw.insertBefore(button,fw.firstChild);updateFavoritesCount(button);return true}function setupFilterInterop(){document.addEventListener('click',function(e){const cf=e.target.closest('.cru-ncf-map-filter:not(.dt-favorites-filter)');if(cf&&favoritesFilterActive){const fb=document.querySelector('.dt-favorites-filter');if(fb){favoritesFilterActive=false;fb.classList.remove('active');applyFavoritesFilter()}}});const rb=document.querySelector('[data-action="reset-filter"], .reset-filter, [class*="reset"]');if(rb){rb.addEventListener('click',function(){const fb=document.querySelector('.dt-favorites-filter');if(fb&&favoritesFilterActive){favoritesFilterActive=false;fb.classList.remove('active');applyFavoritesFilter()}})}}window.addEventListener('dt:favorite-toggled',function(e){const b=document.querySelector('.dt-favorites-filter');if(b){updateFavoritesCount(b);if(favoritesFilterActive)applyFavoritesFilter()}});function checkURLOnLoad(){const u=new URLSearchParams(window.location.search);if(u.get('saved')==='1'||u.get('favorites')==='1'){const b=document.querySelector('.dt-favorites-filter');if(b)toggleFavoritesFilter(b)}}function init(){let attempts=0;const maxAttempts=20;const checkInterval=setInterval(()=>{attempts++;if(injectFavoritesButton()){clearInterval(checkInterval);setupFilterInterop();checkURLOnLoad()}else if(attempts>=maxAttempts){clearInterval(checkInterval)}},300)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}else{init()}})();

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
    notice.style.cssText = 'display:flex; align-items:center; gap:6px; margin:0; font-weight: 400; font-family: Sonnygothiccondensed, Arial, sans-serif; font-size:13px; color: var(--dt-text-almost-blk); padding-left:34px;';
    notice.textContent = 'Next edition: Dates TBA';

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
