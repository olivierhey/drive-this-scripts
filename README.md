# Drive This - Custom Scripts

Custom JavaScript and CSS for the Drive This Webflow site.

## Files

| File | Description |
|------|-------------|
| `event-page.js` | Main JS for event pages (favorites, past event badge, lightbox, etc.) |
| `event-page.css` | Styles for event page components |
| `event-page.min.js` | Minified JS version |

## Usage via jsDelivr CDN

Add to Webflow Page Settings → Before `</body>` tag:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/drive-this-scripts@main/event-page.css">
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/drive-this-scripts@main/event-page.js"></script>
```

Replace `YOUR_USERNAME` with your GitHub username.

## Features

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
Automatically detects past events via `data-event-end` attribute on any element:
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

## Cache Busting

jsDelivr caches files. To force update after changes:
- Use version tags: `@v1.0.0` instead of `@main`
- Or purge cache: `https://purge.jsdelivr.net/gh/YOUR_USERNAME/drive-this-scripts@main/event-page.js`

## Version History

- **1.0.0** - Initial release with favorites, past event badge, lightbox, video embed
