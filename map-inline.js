/**
 * Drive This – Map Inline Logic
 * Version: 9.8
 *
 * Changes from 9.7 (mobile drawer reliability fix):
 *  - NEW setupPinTapHandler(): direct delegated pointer tap on pins.
 *    Drawer no longer depends on NCF adding the "active" class
 *    (which is unreliable on touch, where the first tap is treated
 *    as hover and only shows the tooltip).
 *  - Pan detection threshold is now pointerType-aware:
 *    6px for mouse, 14px for touch (finger taps wobble).
 *  - Pinch gestures (second pointer down) never open the drawer.
 *  - Tooltips hidden on touch devices via injected CSS
 *    (@media hover:none and pointer:coarse) – no hover state exists,
 *    so tooltips only add an extra tap step.
 *  - MutationObserver path kept as desktop fallback; the
 *    currentEventSlug guard prevents double-open.
 *
 * Changes from 9.6:
 *  - Added partnerTier field to getEventData()
 *  - Added Featured / Headline Partner badge to populateDrawer()
 *  - Badge renders in drawer image header (bottom-right)
 *  - Headline = gold fill, Featured = dark with gold border
 */
(function () {

  /* ── Weather config ── */
  const WEATHER_API_KEY = 'e5472fae42c64a6f3aae2820d281c8b9';

  const weatherIcons = {
    sun:         'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b21c3c8fef0fee1f6d3a2_sun.svg',
    moon:        'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22026f960232a5ee2b6b_moon.svg',
    'sun-cloud': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b225475549a09cf3b7ced_sun-cloud.svg',
    'moon-cloud':'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b225a31bcf1568b3ab447_moon-cloud.svg',
    cloud:       'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22900f79853fb27e734d_cloud.svg',
    clouds:      'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22ccca25ab23b4fac45f_clouds.svg',
    rain:        'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b22edf8b5965f7dae4770_rain.svg',
    'sun-rain':  'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b2505122b568fa8a400d1_sun-rain.svg',
    'moon-rain': 'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b25ab816fa5375bb8d16d_moon-rain.svg',
    storm:       'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b25ec30d703bac4ed9167_storm.svg',
    snow:        'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b2611704de73bf8fca88c_snow.svg',
    fog:         'https://cdn.prod.website-files.com/68e3e655c503674ccf7c17f2/693b27035b7e873366cebd4e_fog.svg'
  };

  const weatherIconMap = {
    '01d':'sun','02d':'sun-cloud','03d':'cloud','04d':'clouds','09d':'rain',
    '10d':'sun-rain','11d':'storm','13d':'snow','50d':'fog',
    '01n':'moon','02n':'moon-cloud','03n':'cloud','04n':'clouds','09n':'rain',
    '10n':'moon-rain','11n':'storm','13n':'snow','50n':'fog'
  };

  /* ── DOM refs ── */
  let overlay, drawer, closeBtn, favoriteBtn, handle, header;

  /* ── State ── */
  let currentEventSlug = null;
  let currentImageUrl  = null;
  let touchStartY = 0, touchCurrentY = 0, isDragging = false;
  let mapPointerMoved = false;
  let mapPointerDownX = 0, mapPointerDownY = 0;
  let lastClosedEventName = '';

  /* ── Canonical ── */
  function ensureCanonicalTag() {
    const href = window.location.origin + window.location.pathname;
    let c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement('link'); c.rel = 'canonical'; document.head.appendChild(c); }
    c.href = href;
  }
  ensureCanonicalTag();

  /* ── Slugify (shared helper) ── */
  function slugify(n) {
    if (!n) return '';
    return n.toLowerCase()
      .replace(/[äÄ]/g,'ae').replace(/[öÖ]/g,'oe').replace(/[üÜ]/g,'ue').replace(/[ß]/g,'ss')
      .replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u')
      .replace(/[îïì]/g,'i').replace(/[ôöò]/g,'o').replace(/[ñ]/g,'n').replace(/[ç]/g,'c')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  /* ── Date / Location helpers ── */
  function formatDate(s, e) {
    if (!s) return '';
    const o  = {day:'numeric',month:'short',year:'numeric'};
    const os = {day:'numeric',month:'short'};
    const st = new Date(s);
    if (!e || e === s) return st.toLocaleDateString('en-GB', o);
    const en = new Date(e);
    if (st.getMonth() === en.getMonth() && st.getFullYear() === en.getFullYear())
      return `${st.getDate()} \u2013 ${en.toLocaleDateString('en-GB', o)}`;
    if (st.getFullYear() === en.getFullYear())
      return `${st.toLocaleDateString('en-GB', os)} \u2013 ${en.toLocaleDateString('en-GB', o)}`;
    return `${st.toLocaleDateString('en-GB', o)} \u2013 ${en.toLocaleDateString('en-GB', o)}`;
  }

  function formatLocation(v, c, co) {
    return [v, c, co].filter(Boolean).join(', ');
  }

  /* ── Favorites ── */
  function isFavorited(s) {
    return JSON.parse(localStorage.getItem('dt_favorites') || '[]').includes(s);
  }

  function toggleFavorite(s) {
    let f = JSON.parse(localStorage.getItem('dt_favorites') || '[]');
    if (f.includes(s)) f = f.filter(x => x !== s); else f.push(s);
    localStorage.setItem('dt_favorites', JSON.stringify(f));
    window.dispatchEvent(new CustomEvent('dt:favorite-toggled', {detail:{slug:s,isFavorited:f.includes(s)}}));
    return f.includes(s);
  }

  function updateFavoriteButton(is) {
    favoriteBtn.classList.toggle('is-favorited', is);
    favoriteBtn.querySelector('svg path').setAttribute('fill', is ? '#FF9900' : 'none');
    favoriteBtn.setAttribute('aria-label', is ? 'Remove from favorites' : 'Add to favorites');
  }

  /* ── List hearts ── */
  function getEventSlugFromListItem(li) {
    if (li.dataset.slug) return li.dataset.slug;
    return slugify(li.dataset.name || li.querySelector('h3')?.textContent || '');
  }

  function injectListHearts() {
    document.querySelectorAll('.cru-ncf-map-list-item').forEach(item => {
      if (item.querySelector('.dt-list-heart')) return;
      const h = document.createElement('div');
      h.className = 'dt-list-heart';
      h.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C12 20 2 14.5909 2 8.21591C2 6.83256 2.54705 5.50588 3.52079 4.5277C4.49454 3.54953 5.81522 3 7.19231 3C9.36442 3 11.3 4.2 12 5.0C12.7 4.2 14.6356 3 16.8077 3C18.1848 3 19.5055 3.54953 20.4792 4.5277C21.453 5.50588 22 6.83256 22 8.21591C22 14.5909 12 20 12 20Z" fill="#2a2a3a" stroke="white" stroke-width="0"/></svg>';
      item.style.position = 'relative';
      item.appendChild(h);
    });
  }

  function updateListFavorites() {
    const f = JSON.parse(localStorage.getItem('dt_favorites') || '[]');
    document.querySelectorAll('.cru-ncf-map-list-item').forEach(item => {
      const s = getEventSlugFromListItem(item);
      const h = item.querySelector('.dt-list-heart');
      if (h) h.classList.toggle('is-visible', !!(s && f.includes(s)));
    });
  }

  function initListHearts() { injectListHearts(); updateListFavorites(); }

  function setupListHeartsObserver() {
    initListHearts();
    const lc = document.querySelector('.horizontal-scroll, .cru-ncf-map-list');
    if (lc) {
      new MutationObserver(ms => {
        if (ms.some(m => m.addedNodes.length > 0)) setTimeout(initListHearts, 100);
      }).observe(lc, {childList:true, subtree:true});
    }
  }

  window.addEventListener('dt:favorite-toggled', updateListFavorites);

  /* ── Weather ── */
  async function fetchWeather(lat, lng, eventDate, eventEndDate) {
    const ic = document.getElementById('dt-drawer-weather-icon');
    const te = document.getElementById('dt-drawer-temp');
    if (ic) { ic.style.display = 'none'; ic.classList.remove('is-historical'); }
    if (te) { te.style.display = 'none'; te.classList.remove('is-historical'); }
    if (!lat || !lng || !eventDate) return;
    const ev = new Date(eventDate);
    const td = new Date();
    const endDate = eventEndDate ? new Date(eventEndDate) : new Date(ev);
    endDate.setHours(23,59,59,999);
    if (endDate < td) return;
    const du = Math.max(0, Math.ceil((ev - td) / (1000*60*60*24)));
    if (du <= 5) await fetchForecast(lat, lng, du, ic, te);
    else await fetchHistoricalAverage(lat, lng, ev, ic, te);
  }

  async function fetchForecast(lat, lng, du, ic, te) {
    if (!WEATHER_API_KEY) return;
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${WEATHER_API_KEY}`);
      if (!r.ok) return;
      const d = await r.json();
      const target = new Date();
      target.setDate(target.getDate() + du);
      target.setHours(12,0,0,0);
      let closest = null, minDiff = Infinity;
      for (const item of d.list) {
        const diff = Math.abs(new Date(item.dt*1000) - target);
        if (diff < minDiff) { minDiff = diff; closest = item; }
      }
      if (!closest) return;
      const tmp = Math.round(closest.main.temp);
      const icon = weatherIcons[weatherIconMap[closest.weather[0].icon] || 'cloud'];
      if (ic) { const im = ic.querySelector('img'); if (im) { im.src = icon; im.alt = closest.weather[0].description; ic.style.display = 'flex'; ic.classList.remove('is-historical'); } }
      if (te) { te.textContent = `${tmp}\u00b0C`; te.classList.remove('is-historical'); te.style.display = 'block'; }
    } catch(e) { /* silent */ }
  }

  async function fetchHistoricalAverage(lat, lng, eventDate, ic, te) {
    try {
      const m = eventDate.getMonth(), dy = eventDate.getDate();
      const cy = new Date().getFullYear();
      const ys = [cy-1, cy-2, cy-3];
      const pd = n => n.toString().padStart(2,'0');
      const md = `${pd(m+1)}-${pd(dy)}`;
      const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${ys[2]}-${md}&end_date=${ys[0]}-${md}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.daily?.temperature_2m_max) return;
      const tds = ys.map(y => `${y}-${md}`);
      let ts = 0, ct = 0, wcs = [];
      d.daily.time.forEach((dt, i) => {
        if (tds.includes(dt)) {
          const at = (d.daily.temperature_2m_max[i] + d.daily.temperature_2m_min[i]) / 2;
          if (!isNaN(at)) { ts += at; ct++; }
          if (d.daily.weathercode?.[i] !== undefined) wcs.push(d.daily.weathercode[i]);
        }
      });
      if (ct === 0) return;
      const avg = Math.round(ts / ct);
      const mc = wcs.length > 0 ? wcs.sort((a,b) => wcs.filter(v=>v===a).length - wcs.filter(v=>v===b).length).pop() : 0;
      const icon = weatherIcons[mapWMOCodeToIcon(mc)] || weatherIcons.sun;
      if (ic) { const im = ic.querySelector('img'); if (im) { im.src = icon; im.alt = 'Typical weather'; ic.style.display = 'flex'; ic.classList.add('is-historical'); } }
      if (te) { te.textContent = `${avg}\u00b0C`; te.title = 'Typical temperature for this date'; te.classList.add('is-historical'); te.style.display = 'block'; }
    } catch(e) { /* silent */ }
  }

  function mapWMOCodeToIcon(c) {
    if (c===0||c===1) return 'sun';
    if (c===2) return 'sun-cloud';
    if (c===3) return 'clouds';
    if (c>=45&&c<=48) return 'fog';
    if (c>=51&&c<=57) return 'cloud';
    if (c>=61&&c<=67) return 'rain';
    if (c>=71&&c<=77) return 'snow';
    if (c>=80&&c<=82) return 'sun-rain';
    if (c>=85&&c<=86) return 'snow';
    if (c>=95&&c<=99) return 'storm';
    return 'sun';
  }

  /* ── Color / Image extraction ── */
  function extractColor(el) {
    function rgbToHex(cs) {
      const m = cs.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) return '#' + [m[1],m[2],m[3]].map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
      return cs;
    }
    function isValid(cs) {
      if (!cs||cs==='transparent'||cs==='inherit'||cs==='initial'||cs==='rgba(0, 0, 0, 0)') return false;
      const m = cs.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) {
        const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
        if (r<30&&g<30&&b<30) return false;
        if (r>240&&g>240&&b>240) return false;
        if (Math.max(Math.abs(r-g),Math.abs(g-b),Math.abs(r-b)) < 15) return false;
        if (r>200&&g<100&&b<100) return false;
        if (g>180&&r<100&&b<100) return false;
        return true;
      }
      if (cs.startsWith('#')) {
        const h = cs.replace('#','');
        if (parseInt(h.substr(0,2),16)>200&&parseInt(h.substr(2,2),16)<100&&parseInt(h.substr(4,2),16)<100) return false;
        return true;
      }
      return false;
    }
    const be = el.querySelector('.bottom');
    if (be) { const bg = getComputedStyle(be).backgroundColor; if (isValid(bg)) return rgbToHex(bg); }
    for (const c of el.querySelectorAll('[style*="background"]')) {
      if (c.className.toLowerCase().includes('ticket')||c.textContent.toLowerCase().includes('ticket')) continue;
      const bg = getComputedStyle(c).backgroundColor;
      if (isValid(bg)) return rgbToHex(bg);
    }
    for (const sel of ['[class*="bottom"]','[class*="footer"]','[class*="color"]','[class*="accent"]']) {
      for (const c of el.querySelectorAll(sel)) {
        if (c.className.toLowerCase().includes('ticket')) continue;
        const bg = getComputedStyle(c).backgroundColor;
        if (isValid(bg)) return rgbToHex(bg);
      }
    }
    return '';
  }

  function extractImages(el) {
    const rs = {logo:'', flag:'', heroImage:''};
    for (const im of el.querySelectorAll('img')) {
      if (!im.src) continue;
      const isF = im.src.includes('flag')||im.className.toLowerCase().includes('flag')||im.alt?.toLowerCase().includes('flag')||im.closest('[class*="flag"]');
      const isH = im.className.toLowerCase().includes('hero')||im.className.toLowerCase().includes('image')||im.className.toLowerCase().includes('cover')||im.closest('[class*="hero"]')||im.closest('[class*="image_event"]');
      const isL = im.className.toLowerCase().includes('logo')||im.className.toLowerCase().includes('tn')||im.className.toLowerCase().includes('thumbnail');
      const r = im.getBoundingClientRect();
      const isS = (r.width>0&&r.width<24)||(r.height>0&&r.height<24);
      if (isF&&!rs.flag) rs.flag = im.src;
      else if (isH&&!rs.heroImage) rs.heroImage = im.src;
      else if (isL&&!rs.logo) rs.logo = im.src;
      else if (!isS&&!isF&&!rs.logo) rs.logo = im.src;
    }
    if (!rs.heroImage) { const hi = el.querySelector('img[class*="hero"],img[class*="image"],img[class*="cover"],.event-image img,.hero-image img'); if (hi?.src) rs.heroImage = hi.src; }
    if (!rs.logo) { const li = el.querySelector('img[class*="logo"],img[class*="tn"],img[class*="event"],img[class*="thumbnail"]'); if (li?.src) rs.logo = li.src; }
    if (!rs.heroImage && rs.logo) { const li = el.querySelector(`img[src="${rs.logo}"]`); if (li) { const r = li.getBoundingClientRect(); if (r.width>150||r.height>100) rs.heroImage = rs.logo; } }
    return rs;
  }

  /* ── Drawer open / close ── */
  function openDrawer(data, updateUrl = true) {
    currentEventSlug = data.slug;
    populateDrawer(data);
    fetchWeather(data.lat, data.lng, data.start, data.end);
    overlay.classList.add('is-active');
    drawer.classList.add('is-active');
    document.body.classList.add('dt-drawer-open');
    closeBtn.focus();
    if (updateUrl && data.slug) history.pushState({event:data.slug}, '', `?event=${data.slug}`);
    ensureCanonicalTag();
  }

  function closeDrawer(updateUrl = true) {
    overlay.classList.remove('is-active');
    drawer.classList.remove('is-active');
    document.body.classList.remove('dt-drawer-open');
    drawer.style.transform = '';
    currentEventSlug = null;
    currentImageUrl = null;
    if (updateUrl && window.location.search.includes('event='))
      history.pushState({}, '', window.location.pathname);
    ensureCanonicalTag();
  }

  /* ── Populate drawer ── */
  function populateDrawer(data) {
    const ie = document.getElementById('dt-drawer-image');
    const iu = data.heroImage || data.logo;
    currentImageUrl = iu;
    ie.style.backgroundImage = 'none';
    ie.style.backgroundColor = data.color || '#f3f4f6';
    if (iu) {
      const pl = new Image(), ul = iu, cl = data.color;
      pl.onload = function() {
        if (currentImageUrl !== ul) return;
        ie.style.backgroundImage = cl
          ? `linear-gradient(to top, ${cl} 0%, ${cl}99 20%, ${cl}00 60%), url("${ul}")`
          : `linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%), url("${ul}")`;
      };
      pl.src = ul;
    }
    const ce = document.getElementById('dt-drawer-country');
    if (data.flag) ce.innerHTML = `<img src="${data.flag}" alt="${data.country||''}" loading="lazy"> ${data.country||''}`;
    else ce.textContent = data.country || '';
    ce.style.color = data.color || '';

    const pre = document.getElementById('dt-drawer-price-row');
    const pe  = document.getElementById('dt-drawer-price');
    const pl  = parseInt(data.price) || 0;
    if (pl > 0) {
      let ph = '';
      for (let i = 1; i <= 4; i++) ph += i<=pl ? '<span class="price-active">\u20ac</span>' : '<span class="price-inactive">\u20ac</span>';
      pe.innerHTML = ph;
      pre.style.display = 'flex';
    } else pre.style.display = 'none';

    document.getElementById('dt-drawer-title').textContent = data.name || '';

    const de = document.getElementById('dt-drawer-date');
    const dt = formatDate(data.start, data.end);
    de.querySelector('span').textContent = dt;
    de.style.display = dt ? 'flex' : 'none';

    const le = document.getElementById('dt-drawer-location');
    const lt = formatLocation(data.venue, data.city, data.country);
    le.querySelector('span').textContent = lt;
    le.style.display = lt ? 'flex' : 'none';

    const catRow   = document.getElementById('dt-drawer-category-row');
const catLabel = document.getElementById('dt-drawer-category-label');
const catSvg   = document.getElementById('dt-drawer-category-svg');
const catIcons = {
  'exhibitions': '<path d="M136,216V32a8,8,0,0,0-12.44-6.65l-80,53.33A8,8,0,0,0,40,85.35V216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M136,88h72a8,8,0,0,1,8,8V216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="16" y1="216" x2="240" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="112" x2="104" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="72" y1="112" x2="72" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="72" y1="168" x2="72" y2="184" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="168" x2="104" y2="184" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>',
  'lifestyle':   '<path d="M84.27,171.73l-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3a7.92,7.92,0,0,1,0,14.86l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="176" y1="16" x2="176" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="224" y1="72" x2="224" y2="104" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="152" y1="40" x2="200" y2="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="208" y1="88" x2="240" y2="88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>',
  'meetups':     '<path d="M192,120a59.91,59.91,0,0,1,48,24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M16,144a59.91,59.91,0,0,1,48-24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="144" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M72,216a65,65,0,0,1,112,0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M161,80a32,32,0,1,1,31,40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M64,120A32,32,0,1,1,95,80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>',
  'racing':      '<path d="M48,176c64-55.43,112,55.43,176,0V56C160,111.43,112,.57,48,56V224" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M48,116c64-55.43,112,55.43,176,0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="168" y1="69.48" x2="168" y2="189.48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="104" y1="42.52" x2="104" y2="162.52" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>',
  'tours':       '<circle cx="164" cy="52" r="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M8,200,81.1,75.94a8,8,0,0,1,13.8,0L168,200Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="50.35" y1="128" x2="125.65" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M146.61,163.71l33.06-55.79a8,8,0,0,1,13.76,0L248,200H168" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>'
};
const cat = (data.category || '').toLowerCase();
if (cat && catIcons[cat]) {
  catSvg.innerHTML = catIcons[cat];
  catLabel.textContent = data.category;
  catRow.style.display = 'flex';
} else {
  catRow.style.display = 'none';
}
    document.getElementById('dt-drawer-description').textContent = data.info || '';
    document.getElementById('dt-drawer-offer').style.display = 'none';

    /* ── v9.7: Featured / Headline Partner badge ── */
    const featuredBadge = document.getElementById('dt-drawer-featured-badge');
    if (featuredBadge) {
      const tier = data.partnerTier;
      if (tier === 'Headline') {
        featuredBadge.textContent = '\u2605 Headline Partner';
        featuredBadge.style.cssText = 'display:inline-block;background:#C9A84C;color:#0D0D0D;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding:5px 10px;border-radius:4px;';
      } else if (tier === 'Featured') {
        featuredBadge.textContent = '\u2605 Featured Partner';
        featuredBadge.style.cssText = 'display:inline-block;background:#1a1a1a;color:#C9A84C;border:1px solid #C9A84C;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;padding:5px 10px;border-radius:4px;';
      } else {
        featuredBadge.style.display = 'none';
      }
    }

    const pastBadge = document.getElementById('dt-drawer-past-badge');
    const dateEl    = document.getElementById('dt-drawer-date');
    const checkDate = data.end || data.start;
    if (checkDate) {
      const endDate = new Date(checkDate), today = new Date();
      today.setHours(0,0,0,0);
      if (endDate < today) { pastBadge.style.display = 'inline-block'; dateEl.classList.add('is-past'); }
      else { pastBadge.style.display = 'none'; dateEl.classList.remove('is-past'); }
    } else { pastBadge.style.display = 'none'; dateEl.classList.remove('is-past'); }

    const offerInfo = document.getElementById('dt-drawer-offer-info');
    const offerText = document.getElementById('dt-drawer-offer-text');
    if (data.specialOffer) {
      offerInfo.style.display = 'flex';
      if (data.offerText?.trim()) { offerText.textContent = data.offerText; offerText.style.display = 'block'; }
      else offerText.style.display = 'none';
      const existing = offerInfo.querySelector('.dt-offer-link');
      if (existing) existing.remove();
      const link = document.createElement('a');
      link.href = `/events/${data.slug}`;
      link.className = 'dt-offer-link';
      link.innerHTML = 'View offer details <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      offerInfo.querySelector('.dt-offer-content').appendChild(link);
    } else offerInfo.style.display = 'none';

    const cta = document.getElementById('dt-drawer-cta');
    cta.href = `/events/${data.slug}`;
    cta.style.backgroundColor = data.color || '';

    const we = document.getElementById('dt-drawer-website');
    we.href = data.website || '#'; we.style.display = data.website ? 'flex' : 'none';
    const ine = document.getElementById('dt-drawer-instagram');
    ine.href = data.instagram || '#'; ine.style.display = data.instagram ? 'flex' : 'none';
    const dire = document.getElementById('dt-drawer-directions');
    dire.href = data.directions || '#'; dire.style.display = data.directions ? 'flex' : 'none';

    updateFavoriteButton(isFavorited(data.slug));
  }

  /* ── Event data from list item ── */
  function getEventData(el) {
    const d = {
      slug:         el.dataset.slug || '',
      name:         el.dataset.name || el.querySelector('h3')?.textContent?.trim() || '',
      start:        el.dataset.start || '',
      end:          el.dataset.end || '',
      venue:        el.dataset.venue || '',
      city:         el.dataset.city || '',
      country:      el.dataset.country || '',
      countryCode:  el.dataset.countryCode || '',
      info:         el.dataset.info || '',
      website:      el.dataset.website || '',
      instagram:    el.dataset.instagram || '',
      directions:   el.dataset.directions || '',
      category:     el.dataset.category || '',
      lat:          el.dataset.lat || '',
      lng:          el.dataset.lng || '',
      price:        el.dataset.price || '',
      specialOffer: el.dataset.specialOffer === '1',
      offerText:    el.dataset.offerText || '',
      partnerTier:  el.dataset.partnerTier || '',   // ← v9.7: 'Community' | 'Featured' | 'Headline'
      logo:'', flag:'', heroImage:'', color:''
    };
    if (!d.slug && d.name) d.slug = slugify(d.name);
    const ims = extractImages(el);
    d.logo = ims.logo; d.flag = ims.flag; d.heroImage = ims.heroImage;
    if (!d.flag && d.countryCode) d.flag = `https://flagcdn.com/w40/${d.countryCode.toLowerCase()}.png`;
    d.color = extractColor(el);
    return d;
  }

  /* ── Find helpers ── */
  function findEventByName(n) {
    if (!n) return null;
    const all = document.querySelectorAll('.cru-ncf-map-list-item');
    const sn = n.toLowerCase().trim();
    for (const i of all) {
      const inn = (i.dataset.name || i.querySelector('h3')?.textContent || '').toLowerCase().trim();
      if (inn === sn) return i;
    }
    for (const i of all) {
      const inn = (i.dataset.name || i.querySelector('h3')?.textContent || '').toLowerCase().trim();
      if (inn.includes(sn) || sn.includes(inn)) return i;
    }
    return null;
  }

  function findEventBySlug(s) {
    if (!s) return null;
    const all = document.querySelectorAll('.cru-ncf-map-list-item');
    for (const i of all) {
      if (i.dataset.slug === s) return i;
      if (slugify(i.dataset.name || i.querySelector('h3')?.textContent || '') === s) return i;
    }
    return null;
  }

  /* ── Swipe to close (mobile) ── */
  function onTouchStart(e) {
    if (window.innerWidth >= 768) return;
    touchStartY = e.touches[0].clientY; isDragging = true; drawer.style.transition = 'none';
  }
  function onTouchMove(e) {
    if (!isDragging || window.innerWidth >= 768) return;
    touchCurrentY = e.touches[0].clientY;
    const d = touchCurrentY - touchStartY;
    if (d > 0) drawer.style.transform = `translateY(${d}px)`;
  }
  function onTouchEnd() {
    if (!isDragging || window.innerWidth >= 768) return;
    isDragging = false; drawer.style.transition = '';
    if (touchCurrentY - touchStartY > 100) closeDrawer(); else drawer.style.transform = '';
    touchStartY = 0; touchCurrentY = 0;
  }

  /* ── List item click → drawer ── */
  document.addEventListener('click', e => {
    if (e.target.closest('[class*="chevron"],[class*="scroll-btn"],[class*="arrow"],.ncf-scroll-btn,.cru-scroll-btn,button[class*="scroll"],button[class*="nav"]')) {
      e.stopPropagation(); return;
    }
    const li = e.target.closest('.cru-ncf-map-list-item');
    if (li) setTimeout(() => {
      const d = getEventData(li);
      if (d.slug || d.name) openDrawer(d);
    }, 50);
  });

  /* ── Pan detection ── */
  function setupPanDetection() {
    const mc = document.querySelector('.ncf-map-wrapper, .cru-ncf-map, [class*="mapbox"]');
    if (!mc) { setTimeout(setupPanDetection, 500); return; }
    mc.addEventListener('pointerdown', e => {
      mapPointerDownX = e.clientX; mapPointerDownY = e.clientY; mapPointerMoved = false;
    });
    mc.addEventListener('pointermove', e => {
      const dx = e.clientX - mapPointerDownX, dy = e.clientY - mapPointerDownY;
      /* FIX v9.8: touch-aware threshold – finger taps wobble more than a mouse */
      const threshold = e.pointerType === 'touch' ? 14 : 6;
      if (Math.sqrt(dx*dx + dy*dy) > threshold) mapPointerMoved = true;
    });
  }

  /* ── Direct pin tap → drawer (v9.8) ──
     On touch devices NCF treats the first tap as hover (tooltip only)
     and does not reliably toggle the "active" class, so the
     MutationObserver path misses most taps. This handler reacts to
     the tap itself: pointerdown/up on the pin, with pan + pinch
     detection, and opens the drawer directly. */
  function setupPinTapHandler() {
    const mapEl = document.querySelector('.ncf-map-wrapper, .cru-ncf-map, [class*="ncf-map"]');
    if (!mapEl) { setTimeout(setupPinTapHandler, 500); return; }

    let tapDownX = 0, tapDownY = 0, tapPointerId = null, tapMultiTouch = false;

    mapEl.addEventListener('pointerdown', e => {
      if (tapPointerId !== null) { tapMultiTouch = true; return; } /* second finger = pinch */
      tapMultiTouch = false;
      tapPointerId = e.pointerId;
      tapDownX = e.clientX; tapDownY = e.clientY;
    }, true);

    mapEl.addEventListener('pointercancel', () => {
      tapPointerId = null; tapMultiTouch = false;
    }, true);

    mapEl.addEventListener('pointerup', e => {
      if (e.pointerId !== tapPointerId) return;
      tapPointerId = null;
      if (tapMultiTouch) return;

      const dx = e.clientX - tapDownX, dy = e.clientY - tapDownY;
      const threshold = e.pointerType === 'touch' ? 14 : 6;
      if (Math.sqrt(dx*dx + dy*dy) > threshold) return; /* pan, not tap */

      const pin = e.target.closest('.cru-ncf-pin');
      if (!pin) return;

      const slugClass = [...pin.classList].find(c => c.startsWith('ncf-slug-'));
      if (!slugClass) return;
      const slug = slugClass.replace('ncf-slug-', '');
      if (slug === currentEventSlug && drawer.classList.contains('is-active')) return;

      const li = findEventBySlug(slug);
      if (!li) return;
      const d = getEventData(li);
      /* setTimeout lets NCF finish its own click handling (popup + recenter) first */
      if (d.slug || d.name) setTimeout(() => openDrawer(d), 50);
    }, true);

    console.log('[DT] Pin tap handler active');
  }

  /* ── Hide tooltips on touch devices (v9.8) ──
     No hover state exists on touch; tooltips only intercept the
     first tap. Popups and map recentering remain untouched. */
  function injectTouchStyles() {
    if (document.getElementById('dt-touch-styles')) return;
    const s = document.createElement('style');
    s.id = 'dt-touch-styles';
    s.textContent = [
      '@media (hover: none) and (pointer: coarse) {',
      '  .mapboxgl-marker [class*="tooltip"],',
      '  .mapboxgl-marker [class*="ncf-tip"] { display: none !important; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Pin click via MutationObserver ── */
  function setupPinObserver() {
    const mapEl = document.querySelector('.ncf-map-wrapper, .cru-ncf-map, [class*="ncf-map"]');
    if (!mapEl) { setTimeout(setupPinObserver, 500); return; }

    new MutationObserver(mutations => {
      for (const m of mutations) {
        const el = m.target;
        if (!el.classList?.contains('cru-ncf-pin')) continue;
        if (!el.classList.contains('active')) continue;
        if (m.oldValue && m.oldValue.split(' ').includes('active')) continue;
        if (mapPointerMoved) { mapPointerMoved = false; continue; }
        const slugClass = [...el.classList].find(c => c.startsWith('ncf-slug-'));
        if (!slugClass) continue;
        const slug = slugClass.replace('ncf-slug-', '');
        if (slug === currentEventSlug) continue;
        const li = findEventBySlug(slug);
        if (!li) continue;
        const d = getEventData(li);
        if (d.slug || d.name) openDrawer(d);
        break;
      }
    }).observe(mapEl, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true
    });

    console.log('[DT] Pin observer active');
  }

  /* ── URL state ── */
  function openDrawerFromUrl() {
    const slug = new URLSearchParams(window.location.search).get('event');
    if (!slug) return;
    let at = 0;
    const ch = setInterval(() => {
      at++;
      const li = findEventBySlug(slug);
      if (li) { clearInterval(ch); const d = getEventData(li); openDrawer(d, false); li.scrollIntoView({behavior:'smooth',block:'center'}); }
      else if (at >= 50) clearInterval(ch);
    }, 100);
  }

  window.addEventListener('popstate', () => {
    const slug = new URLSearchParams(window.location.search).get('event');
    if (slug) { const li = findEventBySlug(slug); if (li) openDrawer(getEventData(li), false); }
    else closeDrawer(false);
  });

  /* ── Init ── */
  function boot() {
    overlay = document.getElementById('dt-drawer-overlay');
    drawer  = document.getElementById('dt-drawer');
    if (!drawer) { setTimeout(boot, 200); return; }
    closeBtn    = document.getElementById('dt-drawer-close');
    favoriteBtn = document.getElementById('dt-drawer-favorite');
    handle      = drawer.querySelector('.dt-drawer-handle');
    header      = drawer.querySelector('.dt-drawer-header');

    closeBtn.addEventListener('click', () => closeDrawer());
    overlay.addEventListener('click', () => closeDrawer());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('is-active')) closeDrawer();
    });
    favoriteBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!currentEventSlug) return;
      const is = toggleFavorite(currentEventSlug);
      updateFavoriteButton(is);
      favoriteBtn.classList.remove('just-toggled');
      void favoriteBtn.offsetWidth;
      favoriteBtn.classList.add('just-toggled');
    });

    handle.addEventListener('touchstart', onTouchStart, {passive:true});
    handle.addEventListener('touchmove',  onTouchMove,  {passive:true});
    handle.addEventListener('touchend',   onTouchEnd);
    header.addEventListener('touchstart', onTouchStart, {passive:true});
    header.addEventListener('touchmove',  onTouchMove,  {passive:true});
    header.addEventListener('touchend',   onTouchEnd);

    const _origClose = closeDrawer;
    closeDrawer = function(updateUrl = true) {
      const titleEl = document.getElementById('dt-drawer-title');
      lastClosedEventName = titleEl ? titleEl.textContent : '';
      _origClose(updateUrl);
      setTimeout(() => { lastClosedEventName = ''; }, 1500);
    };

    window.DriveThisDrawer = {
      open:   openDrawer,
      close:  closeDrawer,
      isOpen: () => drawer.classList.contains('is-active'),
      favorites: {
        list:   () => JSON.parse(localStorage.getItem('dt_favorites') || '[]'),
        has:    isFavorited,
        toggle: toggleFavorite,
        clear:  () => localStorage.removeItem('dt_favorites')
      }
    };

    injectTouchStyles();
    setTimeout(setupPinObserver,        500);
    setTimeout(setupPinTapHandler,      500);
    setTimeout(setupPanDetection,       500);
    setTimeout(setupListHeartsObserver, 500);
    openDrawerFromUrl();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('DT v9.8');

})();
