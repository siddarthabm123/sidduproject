# Warm Stone UI redesign

Branch: `codex/ui-redesign-warm-stone`. Existing uncommitted project work was preserved when creating this branch.

The four passes update the Tailwind 4 CSS theme, sticky navigation/marketplace search, equipment cards/photos, and quote/fleet presentation. The project uses CSS-based Tailwind configuration in `index.css`, not a separate Tailwind config file.

## Palette and typography

- Canvas `#F4F2ED`, white surfaces, taupe borders `#E5E0D8`.
- Structural anchors `#142824`, primary buttons `#D9531E`, hover `#B84315`.
- Availability/verified labels `#1E6B52` on `#E8F3EF`.
- Ink `#1A1D1B`, muted copy `#5C635E`.
- Plus Jakarta Sans for UI/headings; JetBrains Mono with tabular numerals for prices and technical data. System fonts remain available if Google Fonts is blocked; Hindi/Kannada retain system-script fallbacks.

Small white text on `#D9531E` falls below 4.5:1 contrast, so normal primary buttons use dark `#0D120F` text. Hover switches to white on `#B84315`. Keyboard focus, reduced motion, dark theme and browser zoom remain available.

## Existing logic preserved

Booking, quote calculations, the 3.5% fee, API/auth/data-loading code, saved records and navigation destinations stay unchanged. Daily/Weekly/Monthly on real-account search are date presets for 1/7/30 inclusive calendar days. They only call the existing end-date setter; rates remain in each listing's actual billing unit. No weekly discount, monthly package, new GST charge, optional operator fee or model year was invented. Any real model year is shown only if the response provides it.

The demo catalogue adds an availability display filter alongside the existing query and sector handlers. The real catalogue retains its existing query, category and date/capacity checks. Per-card quote buttons open the existing selected-units review. Model-specific photos are shown in quotes and fleet cards without rewriting saved image URLs.

Equipment images use a 16:10 frame, object-cover and reduced-motion-aware hover. A failing source uses the existing category photograph; if that also fails, a textual unavailable state prevents an infinite error loop. SVG image sources are not used for equipment media. Existing Lucide UI icons are retained.

## New demo photo credits

Only three duplicate seed images were reassigned. Wikimedia JPEGs (originals or available previews) are used without pixel edits; CSS crops them in the card view. These are illustrative category photos for fictional demo listings, not proof of an owner's actual machine or its model specifications. Visible photo/source/license links accompany these images.

| Demo asset | Creator and source | License |
|---|---|---|
| `compact-excavator-photo.jpg` | [Isaac Egger - Mini Excavator](https://commons.wikimedia.org/wiki/File:Mini_Excavator.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `farm-tractor-photo.jpg` | [Bob Adams - Massey Ferguson 440 tractor](https://commons.wikimedia.org/wiki/File:Massey_Ferguson_440_tractor_(15701374518).jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `drilling-rig-photo.jpg` | [Mcfly05 - Water well drilling rig](https://commons.wikimedia.org/wiki/File:Water_well_drilling_rig.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Existing photo assets and supplied live inventory image URLs are preserved. Their provenance is not established by this styling work.

## Verification boundaries

Automated checks exercise contrast, image fallback/uniqueness and inclusive date presets. The quote calculation/submit functions and real workspace code before JSX were compared against pre-redesign snapshots and are unchanged except whitespace. Responsive CSS targets mobile and desktop with stacked filters and bounded modal scrolling. Browser tools currently fail during initialization, so a visual/click-through check at 375px and 1280px remains outstanding. No production deployment or database update is included in this redesign.
