/* Drive This · top-loader.js v1.0.0
   Thin progress bar at the top edge while the page (and on the map page: the map) loads.
   Include site-wide in <head> custom code, before other scripts, so it shows from the first paint:
   <script src="https://cdn.jsdelivr.net/gh/olivierhey/drive-this-scripts@<tag>/top-loader.js"></script>
   Optional: window.DT_LOADER_COLOR = '#ffffff' before the script to override the colour. */
(function () {
  'use strict';
  if (window.DTLoader) return;

  var color = window.DT_LOADER_COLOR || '#ffffff';
  var bar, pct = 0, timer = null, finished = false, started = false;

  var style = document.createElement('style');
  style.textContent =
    '#dt-top-loader{position:fixed;top:0;left:0;height:2px;width:0;z-index:99999;pointer-events:none;' +
    'background:' + color + ';box-shadow:0 0 8px ' + color + ';opacity:1;' +
    'transition:width .25s ease-out,opacity .4s ease .2s}' +
    '#dt-top-loader.is-done{width:100%!important;opacity:0}';
  document.head.appendChild(style);

  function set(p) {
    pct = Math.max(pct, Math.min(p, 99));
    if (bar) bar.style.width = pct + '%';
  }

  function start() {
    if (started) return;
    started = true;
    bar = document.createElement('div');
    bar.id = 'dt-top-loader';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Loading');
    (document.body || document.documentElement).appendChild(bar);
    set(8);
    // creep towards 90% with slowing steps, like browsers do
    timer = setInterval(function () {
      var step = pct < 40 ? 6 : pct < 70 ? 3 : pct < 90 ? 1 : 0.2;
      set(pct + step);
    }, 150);
  }

  function done() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    if (!bar) return;
    bar.classList.add('is-done');
    setTimeout(function () { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }, 900);
  }

  function watchMap() {
    // map page: finished when the first NCF pin exists
    if (document.querySelector('.cru-ncf-pin')) { done(); return true; }
    return false;
  }

  function boot() {
    start();
    var isMap = !!document.querySelector('.cru-ncf-map-filter, .ncf-map-wrapper, .cru-ncf-map');
    if (isMap) {
      if (!watchMap()) {
        var obs = new MutationObserver(function () { if (watchMap()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(done, 8000);              // never hang
      }
    } else {
      if (document.readyState === 'complete') done();
      else window.addEventListener('load', function () { setTimeout(done, 100); });
      setTimeout(done, 6000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.DTLoader = { done: done, set: set };
})();
