/**
 * DRIVE THIS - Calendar Export
 * Version: 1.0.1 (2026-10-02)
 * 1.0.1: Short label "Download" on mobile (< 768px), tighter padding.
 *
 * One-time .ics export, no sync.
 *  - Map page: "Download calendar" next to the Saved filter chip, visible
 *    only while Saved is active. Exports every upcoming saved event.
 *  - Event page: "Add to calendar" next to #dt-event-favorite. Exports the
 *    current event. Hidden when the event has no valid future date.
 *
 * Data sources (nothing new required on the Map):
 *  - Map: data-* attributes already on .cru-ncf-map-list-item
 *    (slug, name, start, end, venue, city, country, category, info, status).
 *  - Event page: optional #dt-calendar-data element with the same data-*
 *    attributes. Fallbacks: h1 for the name, [data-event-start] /
 *    [data-event-end] for dates, URL path for the slug.
 *
 * Storage key dt_favorites and event dt:favorite-toggled are only read.
 *
 * Config (optional, set before this script loads):
 *   window.DT_CALENDAR_CONFIG = { eventPath: '/events/' };
 */
(function () {
  'use strict';
  if (window.DTCalendarLoaded) return;
  window.DTCalendarLoaded = true;

  const CFG = Object.assign({
    origin: 'https://www.drive-this.com',
    eventPath: '/events/',
    storageKey: 'dt_favorites',
    uidDomain: 'drive-this.com',
    prodId: '-//Drive This//European Car Event Map//EN',
    calName: 'Drive This · Saved events'
  }, window.DT_CALENDAR_CONFIG || {});

  const log = (m) => console.log('[DT Calendar] ' + m);

  /* ───────────── Dates ───────────── */

  // Returns 'YYYY-MM-DD' or '' for anything unusable (empty, Webflow
  // placeholder, unparseable).
  function toISODate(v) {
    if (!v) return '';
    v = String(v).trim();
    if (!v || v.includes('{{')) return '';
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function todayISO() {
    return toISODate(new Date().toString());
  }

  // 'YYYY-MM-DD' + n days, computed in UTC to avoid DST shifts.
  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  }

  const icsDate = (iso) => iso.replace(/-/g, '');

  function icsStamp(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /* ───────────── ICS text ───────────── */

  function escText(s) {
    return String(s || '')
      .replace(/<[^>]*>/g, ' ')                       // strip stray HTML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // Fold at 75 octets without splitting a UTF-8 character.
  const enc = new TextEncoder();
  function fold(line) {
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let cur = '', bytes = 0, limit = 75;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > limit) {
        out.push(cur);
        cur = ''; bytes = 0; limit = 74;              // continuation lines start with a space
      }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }

  function eventUrl(slug) {
    return CFG.origin + CFG.eventPath + slug;
  }

  function vevent(ev, stamp) {
    const end = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
    const url = ev.url || eventUrl(ev.id);
    const desc = [ev.shortDescription, url].filter(Boolean).join('\n');
    const loc = [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
    const lines = [
      'BEGIN:VEVENT',
      `UID:${ev.id}-${ev.startDate.slice(0, 4)}@${CFG.uidDomain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.startDate)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`, // exclusive end
      `SUMMARY:${escText(ev.title)}`,
      `DESCRIPTION:${escText(desc)}`
    ];
    if (loc) lines.push(`LOCATION:${escText(loc)}`);
    lines.push(`URL:${url}`);
    if (ev.category) lines.push(`CATEGORIES:${escText(ev.category)}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:TRANSPARENT', 'END:VEVENT');
    return lines;
  }

  function createCalendarFile(events) {
    const stamp = icsStamp(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${CFG.prodId}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    if (events.length > 1) lines.push(`X-WR-CALNAME:${escText(CFG.calName)}`);
    events.forEach(ev => lines.push(...vevent(ev, stamp)));
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  function downloadICS(ics, filename) {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* ───────────── Event data ───────────── */

  function normalize(raw) {
    const startDate = toISODate(raw.start);
    const endDate = toISODate(raw.end) || startDate;
    return {
      id: (raw.slug || '').trim(),
      title: (raw.name || '').trim(),
      startDate,
      endDate,
      venue: (raw.venue || '').trim(),
      city: (raw.city || '').trim(),
      country: (raw.country || '').trim(),
      category: (raw.category || '').trim(),
      shortDescription: (raw.info || '').trim(),
      status: (raw.status || '').trim().toLowerCase(),
      url: raw.url || ''
    };
  }

  // Reason string if not exportable, '' if fine.
  function ineligible(ev, today) {
    if (!ev.id || !ev.title) return 'invalid';
    if (ev.status === 'cancelled' || ev.status === 'canceled') return 'cancelled';
    if (!ev.startDate) return 'nodate';
    if ((ev.endDate || ev.startDate) < today) return 'past';
    return '';
  }

  /* ───────────── Feedback ───────────── */

  let live;
  function announce(msg) {
    if (!live) {
      live = document.createElement('div');
      live.className = 'dt-cal-toast';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = msg;
    live.classList.add('is-visible');
    clearTimeout(announce._t);
    announce._t = setTimeout(() => live.classList.remove('is-visible'), 4000);
  }

  function track(name, props) {
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props });
      if (typeof window.gtag === 'function') window.gtag('event', name, props);
    } catch (e) { /* analytics must never break the export */ }
  }

  /* ───────────── Styles ───────────── */

  const ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';

  function injectStyles() {
    if (document.getElementById('dt-cal-styles')) return;
    const s = document.createElement('style');
    s.id = 'dt-cal-styles';
    s.textContent = `
.dt-cal-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:14px;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer;user-select:none;transition:background .2s ease,opacity .2s ease}
.dt-cal-btn svg{width:18px;height:18px;margin-top:-2px;flex-shrink:0;display:block}
.dt-cal-btn:focus-visible{outline:2px solid #FF9900;outline-offset:2px}
.dt-cal-btn[disabled]{cursor:default;opacity:.55}
.dt-cal-map{height:44px;padding:8px 16px;border:1px solid rgba(255,255,255);border-radius:4px;background:rgba(255,255,255,.1);color:#fff}
.dt-cal-map:not([disabled]):hover{background:rgba(255,255,255,.2)}
.dt-cal-map[hidden]{display:none!important}
.dt-cal-short{display:none}
@media (max-width:767px){.dt-cal-map{padding:8px 16px;gap:8px}.dt-cal-long{display:none}.dt-cal-short{display:inline}}
.dt-cal-page{height:48px;padding:0 18px;border:1.5px solid currentColor;border-radius:10px;background:transparent;color:inherit}
.dt-cal-page:hover{background:rgba(127,127,127,.12)}
.dt-cal-wrap{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
.dt-cal-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,12px);z-index:10000;max-width:calc(100% - 32px);padding:12px 18px;border-radius:8px;background:#111;color:#fff;font-size:14px;line-height:1.35;box-shadow:0 6px 24px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease}
.dt-cal-toast.is-visible{opacity:1;transform:translate(-50%,0)}
`;
    document.head.appendChild(s);
  }

  /* ───────────── Map: bulk export ───────────── */

  function getSavedIds() {
    const v = JSON.parse(localStorage.getItem(CFG.storageKey) || '[]');
    return Array.isArray(v) ? [...new Set(v.filter(Boolean))] : [];
  }

  function slugify(n) {
    return (n || '').toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
      .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ùûü]/g, 'u')
      .replace(/[îïì]/g, 'i').replace(/[ôöò]/g, 'o').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // Current card data, keyed by slug. Read at click time so the file
  // always reflects the latest loaded CMS data.
  function cardIndex() {
    const idx = {};
    document.querySelectorAll('.cru-ncf-map-list-item').forEach(el => {
      const d = el.dataset;
      const slug = d.slug || slugify(d.name || el.querySelector('h3')?.textContent || '');
      if (!slug || idx[slug]) return;
      idx[slug] = normalize({
        slug,
        name: d.name || el.querySelector('h3')?.textContent || '',
        start: d.start, end: d.end,
        venue: d.venue, city: d.city, country: d.country,
        category: d.category, info: d.info, status: d.status
      });
    });
    return idx;
  }

  function evaluateSaved() {
    let ids;
    try { ids = getSavedIds(); } catch (e) { return { error: true }; }
    const idx = cardIndex();
    const today = todayISO();
    const ok = [], skipped = [];
    ids.forEach(id => {
      const ev = idx[id];
      if (!ev) { skipped.push('missing'); return; }
      const why = ineligible(ev, today);
      if (why) skipped.push(why); else ok.push(ev);
    });
    ok.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { total: ids.length, ok, skipped };
  }

  function exportSaved() {
    const r = evaluateSaved();
    if (r.error) { announce('Saved events could not be loaded'); return; }
    if (!r.ok.length) { announce('No upcoming saved events'); return; }
    try {
      const years = r.ok.map(e => e.startDate.slice(0, 4));
      const y0 = years[0], y1 = years[years.length - 1];
      const fname = `drive-this-saved-events-${y0 === y1 ? y0 : y0 + '-' + y1}.ics`;
      downloadICS(createCalendarFile(r.ok), fname);
    } catch (e) {
      log(e.message);
      announce('Calendar could not be created. Please try again.');
      return;
    }
    const n = r.ok.length, k = r.skipped.length;
    // Missing IDs are skipped silently; past, TBA and cancelled are reported.
    const reported = r.skipped.filter(x => x !== 'missing').length;
    let msg = `Calendar downloaded · ${n} upcoming ${n === 1 ? 'event' : 'events'}`;
    if (reported) msg = `Calendar downloaded · ${n} ${n === 1 ? 'event' : 'events'} · ${reported} without a future date ${reported === 1 ? 'was' : 'were'} skipped`;
    announce(msg);
    track('calendar_saved_download', { event_count: n, skipped_count: k, source: 'map_saved_filter' });
  }

  function initMap() {
    let tries = 0;
    const iv = setInterval(() => {
      const chip = document.querySelector('.dt-favorites-filter');
      if (!chip && ++tries < 40) return;
      clearInterval(iv);
      if (!chip) return;
      if (document.querySelector('.dt-cal-map')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dt-cal-btn dt-cal-map';
      btn.title = 'One-time calendar export. Later event changes are not updated automatically.';
      btn.hidden = true;
      btn.innerHTML = ICON + '<span class="dt-cal-label dt-cal-long">Download calendar</span><span class="dt-cal-label dt-cal-short">Download</span>';
      btn.setAttribute('aria-label', 'Download calendar');
      chip.insertAdjacentElement('afterend', btn);

      // Capture phase, same as the Saved chip, so NCF filter handlers never see it.
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (!btn.disabled) exportSaved();
      }, true);
      btn.addEventListener('mousedown', e => { e.stopPropagation(); }, true);

      const longLabel = btn.querySelector('.dt-cal-long');
      const shortLabel = btn.querySelector('.dt-cal-short');
      const sync = () => {
        const active = chip.classList.contains('active');
        let ids = [];
        try { ids = getSavedIds(); } catch (e) { /* treated as none */ }
        btn.hidden = !active || ids.length === 0;
        if (btn.hidden) return;
        const r = evaluateSaved();
        const none = !r.error && r.ok.length === 0;
        btn.disabled = none;
        longLabel.textContent = none ? 'No upcoming saved events' : 'Download calendar';
        shortLabel.textContent = none ? 'No upcoming' : 'Download';
        btn.setAttribute('aria-label', none ? 'No upcoming saved events' : 'Download calendar');
      };

      new MutationObserver(sync).observe(chip, { attributes: true, attributeFilter: ['class'] });
      window.addEventListener('dt:favorite-toggled', () => setTimeout(sync, 0));
      sync();
      // Cards may arrive after the chip; re-check once they are in.
      [800, 2000, 4000].forEach(t => setTimeout(sync, t));
      log('Map export ready');
    }, 300);
  }

  /* ───────────── Event page: single export ───────────── */

  function pageEvent() {
    const src = document.getElementById('dt-calendar-data');
    const d = src ? src.dataset : {};
    const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a) || '';
    const clean = v => (v && !String(v).includes('{{')) ? v : '';
    const slug = clean(d.slug) || window.location.pathname.split('/').filter(Boolean).pop() || '';
    return normalize({
      slug,
      name: clean(d.name) || document.querySelector('h1')?.textContent || '',
      start: clean(d.start) || clean(attr('[data-event-start]', 'data-event-start')),
      end: clean(d.end) || clean(attr('[data-event-end]', 'data-event-end')),
      venue: clean(d.venue), city: clean(d.city), country: clean(d.country),
      category: clean(d.category), info: clean(d.info), status: clean(d.status),
      url: window.location.origin + window.location.pathname
    });
  }

  function initEventPage() {
    const fav = document.getElementById('dt-event-favorite');
    if (!fav || document.querySelector('.dt-cal-page')) return;

    const ev = pageEvent();
    if (ineligible(ev, todayISO())) { log('Event not exportable, button hidden'); return; }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dt-cal-btn dt-cal-page';
    btn.title = 'One-time calendar export. Later event changes are not updated automatically.';
    btn.innerHTML = ICON + '<span>Add to calendar</span>';

    // Wrap Save + Add side by side without touching Webflow's layout of the
    // favorite button itself.
    const wrap = document.createElement('div');
    wrap.className = 'dt-cal-wrap';
    fav.parentNode.insertBefore(wrap, fav);
    wrap.appendChild(fav);
    wrap.appendChild(btn);

    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const cur = pageEvent();                     // re-read at click time
      if (ineligible(cur, todayISO())) { announce('No upcoming date for this event'); return; }
      try {
        downloadICS(createCalendarFile([cur]), `drive-this-${cur.id}-${cur.startDate.slice(0, 4)}.ics`);
      } catch (err) {
        log(err.message);
        announce('Calendar could not be created. Please try again.');
        return;
      }
      announce('Calendar downloaded');
      let saved = false;
      try { saved = getSavedIds().includes(cur.id); } catch (e2) { /* ignore */ }
      track('calendar_single_download', {
        event_id: cur.id, event_name: cur.title, event_category: cur.category,
        event_year: cur.startDate.slice(0, 4), source: 'event_page', saved
      });
    });
    log('Event export ready');
  }

  /* ───────────── Boot ───────────── */

  function boot() {
    injectStyles();
    if (document.getElementById('dt-event-favorite')) initEventPage();
    if (document.querySelector('.ncf-filter-options-wrapper, .cru-ncf-map-list-item, .ncf-map-wrapper')) initMap();
  }

  // Exposed for testing in the console
  window.DriveThisCalendar = { createCalendarFile, evaluateSaved, exportSaved, pageEvent, normalize, config: CFG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
