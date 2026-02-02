# Drive This - Custom Scripts

Custom JavaScript and CSS for the Drive This Webflow site.

## Files

| File | Description |
| --- | --- |
| `event-page.js` | Main JS for event detail pages (favorites, past event badge, lightbox, etc.) |
| `event-page.css` | Styles for event page components |
| `event-page.min.js` | Minified JS version |
| `map-page.js` | **NEW** - Horizontal scroll enhancement for map event list |
| `map-page.css` | **NEW** - Styles for scroll chevrons and drag-to-scroll |

---

## Usage via jsDelivr CDN

### Event Detail Pages
Add to Webflow Page Settings → Before `</body>` tag:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/event-page.css">
<script src="https://cdn.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/event-page.js"></script>
```

### Map Page
Add to Webflow Page Settings → Before `</body>` tag:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/map-page.css">
<script src="https://cdn.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/map-page.js"></script>
```

---

## Map Page Features

### Horizontal Scroll Enhancement

Improves the UX of the horizontal event list with multiple scroll methods:

| Method | Target Users |
| --- | --- |
| **Chevron Buttons** | All users - clear visual affordance |
| **Drag-to-Scroll** | Mouse users without scroll wheel |
| **Wheel Y→X** | Mouse users with scroll wheel |
| **Native Horizontal** | Trackpad users (preserved) |

#### How it works

1. **Chevrons** appear/disappear based on scroll position (fade in/out)
2. **Drag** the list with mouse - cursor changes to grabbing
3. **Scroll wheel** vertical movement converts to horizontal
4. **Trackpad** horizontal swipe works natively

#### Required HTML Structure

The script expects this Webflow/NoCodeFlow structure:

```html
<div class="horizontal-scroll">
  <div class="cru-ncf-map-item-list">
    <!-- Event cards -->
  </div>
</div>
```

#### Configuration

You can customize via the global object:

```javascript
// Adjust scroll amount per click
DriveThisMapScroll.config.scrollAmount = 400;

// Reinitialize if needed
DriveThisMapScroll.reinit();
```

---

## Event Page Features

### Favorite Button

Add this HTML where you want the button:

```html
<button id="dt-event-favorite" class="dt-event-favorite" aria-label="Add to favorites">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
  <span class="dt-favorite-text">Save Event</span>
</button>
```

### Past Event Badge

Automatically detects past events via `data-event-end` attribute:

```html
<div class="meta-date" data-event-end="2024-12-31">...</div>
```

### Lightbox

Add `data-lightbox` to any image:

```html
<img src="..." data-lightbox>
```

### Video Embed

Add `data-video-url` to a container:

```html
<div data-video-url="https://www.youtube.com/watch?v=VIDEO_ID"></div>
```

### Deal Code Copy

Add `data-copy-code` to make text copyable:

```html
<span class="dt-deal-code" data-copy-code="DRIVETHIS10">DRIVETHIS10</span>
```

---

## Cache Busting

jsDelivr caches files. To force update after changes:

**Option 1:** Use version tags
```
@v1.0.0 instead of @main
```

**Option 2:** Purge cache manually
```
https://purge.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/map-page.js
https://purge.jsdelivr.net/gh/olivierhey/drive-this-scripts@main/map-page.css
```

---

## Version History

| Version | Date | Changes |
| --- | --- | --- |
| **1.1.0** | 2026-02 | Added map page horizontal scroll enhancement |
| **1.0.0** | 2025 | Initial release with favorites, past event badge, lightbox, video embed |

---

## Development

### Local Testing

1. Clone the repo
2. Open your Webflow site
3. In Page Settings, temporarily point to local files or use a tool like [ngrok](https://ngrok.com)

### Minification

Use any JS minifier for production:

```bash
# Using terser
npx terser map-page.js -o map-page.min.js -c -m
```
