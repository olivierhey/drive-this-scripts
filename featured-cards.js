/*!
 * Drive This — featured-cards.js v1.0.0
 *
 * Applies the partner highlight bar to timeline cards via injected CSS
 * instead of inline styles.
 *
 * Why CSS: the NCF map loads CMS list items in stages. Inline styles only
 * reach elements that exist at the moment the function runs, so partners
 * later in the season (November onward) were never highlighted. A CSS rule
 * matches elements that appear afterwards too.
 *
 * Reads the colour list from window._dtFeaturedEvents, which is set by the
 * inline featured-pins script. No duplicate list to maintain.
 */
(function () {
  'use strict';

  var STYLE_ID = 'dt-featured-card-styles';

  function inject() {
    var events = window._dtFeaturedEvents;
    if (!Array.isArray(events) || !events.length) return false;

    var rules = events
      .filter(function (e) { return e && e.slug && e.color; })
      .map(function (e) {
        return '.cru-ncf-map-list-item[data-slug="' + e.slug + '"][data-featured="1"]' +
               '{box-shadow:inset 0 5px 0 0 ' + e.color + ' !important;}';
      });

    if (!rules.length) return false;

    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }

    var css = rules.join('\n');
    if (el.textContent !== css) {
      el.textContent = css;
      console.log('[DT Featured] ' + rules.length + ' card style(s) injected.');
    }
    return true;
  }

  function start() {
    // First pass as soon as the colour list exists.
    inject();
    // Second pass after the retry cycle in the inline script (2500 ms),
    // which may correct colours read from the CMS.
    setTimeout(inject, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(start, 100);
    });
  } else {
    setTimeout(start, 100);
  }
})();
