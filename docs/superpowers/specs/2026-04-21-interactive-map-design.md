# Interactive Map with Two-Column Layout

**Date:** 2026-04-21
**Status:** Approved

## Overview

Transform the current single-column layout into a two-column layout with an interactive sticky map on the right side. Add school and supermarket POI markers via Overpass API (OpenStreetMap) with toggle controls.

## Layout

### Desktop (≥ 768px)

Two-column grid layout:

- **Left column** (~55% width, scrollable): Search bar (with logo/branding), matched label, then all info sections — QuickStats, Amenities, Migration, HousingTypes, ElectionResults.
- **Right column** (~45% width, sticky): Interactive Leaflet map. Uses `position: sticky; top: <offset>` so the map stays visible in the viewport as the user scrolls the left column.

The outer container uses `max-w-6xl` (up from `max-w-3xl`) to accommodate the wider layout. The left column retains the current card styling and spacing.

### Mobile (< 768px)

Single column, in this order:

1. Search bar (with logo/branding)
2. Map (full width, fixed height, scrolls with page — not sticky)
3. Info sections (QuickStats, Amenities, Migration, HousingTypes, ElectionResults)

### Before Search (Default State)

- **Map**: Shows a zoomed-out view of the Netherlands (center: ~52.2°N, 5.3°E, zoom level ~7). No boundary overlay. Toggle buttons hidden.
- **Left column**: Only the search bar is visible. No info sections, no skeleton loaders.

### After Search

- **Map**: Zooms to the searched area, displays the buurt/wijk/postcode boundary with the existing dashed orange line style (`color: #E65100`, `weight: 3`, `dashArray: "8, 6"`, `fillOpacity: 0.08`).
- **Left column**: Populates with all info sections.
- **Toggle buttons**: Become visible on the map.

## Map Component Changes (`PostcodeMap.tsx`)

### Current Behavior

- Receives a `postcode` string prop.
- Creates a new Leaflet map on each render, fetches TopoJSON, finds matching feature, fits bounds.
- Fixed height 300px, scroll wheel zoom disabled.

### New Behavior

**Props change:**

```typescript
interface PostcodeMapProps {
  postcode: string | null; // null = show default NL view
}
```

**Default NL view:** When `postcode` is `null`, render the map centered on the Netherlands (lat 52.2, lng 5.3, zoom 7) with tile layer only — no boundary, no POI toggles.

**Map height:** Change from fixed 300px to `calc(100vh - 2rem)` on desktop (fills viewport minus padding). On mobile, use a fixed 300px height.

**Scroll wheel zoom:** Enable on desktop (the map is the primary right-column element). Keep disabled on mobile.

**Zoom controls:** Leaflet's built-in zoom control (already enabled).

### POI Toggle Buttons

Two toggle buttons overlaid on the map (top-right area, below zoom controls):

- **Schools** (🏫): Shows/hides primary school markers
- **Supermarkets** (🛒): Shows/hides supermarket markers

**Styling:** Small pill-shaped buttons with white background, subtle border, icon + label text. When active: orange background (#E65100) with white text. When inactive: white background with gray text.

**Default state:** Both off. Buttons hidden until a search is performed.

### Overpass API Integration

When a search is performed and the map has a boundary:

1. Calculate the bounding box of the area boundary. Extend each side by ~0.005° (~500m) to include POIs just outside the boundary.
2. Query the Overpass API for:
   - Schools: `node["amenity"="school"](bbox); way["amenity"="school"](bbox);`
   - Supermarkets: `node["shop"="supermarket"](bbox); way["shop"="supermarket"](bbox);`
3. Cache the results in component state (keyed by postcode) so toggling on/off doesn't re-fetch.
4. Render results as Leaflet markers with distinct styling:
   - **Schools**: Blue circle markers or 🏫 icon
   - **Supermarkets**: Green circle markers or 🛒 icon
5. Each marker has a popup showing the name (from OSM `name` tag) if available.

**Overpass endpoint:** `https://overpass-api.de/api/interpreter`

**Error handling:** If Overpass fails (rate limit, timeout), the toggle buttons show a brief error tooltip. The map and boundary remain functional.

**Query timing:** Fetch POI data in parallel with (not blocking) the main area data display. POI data is loaded eagerly after search but only rendered when toggles are activated.

## Page Layout Changes (`page.tsx`)

### Structure Change

```
Current:
<main max-w-3xl>
  <SearchCard />
  <InfoSections />   ← single column
</main>

New:
<main max-w-6xl>
  <div grid cols-1 md:cols-[1fr,minmax(0,500px)]>
    <div>                    ← left column (scrollable)
      <SearchCard />
      <InfoSections />
    </div>
    <div sticky>             ← right column (sticky on desktop)
      <PostcodeMap />
    </div>
  </div>
</main>
```

### Key Details

- The search card stays in the left column on desktop. On mobile it's above the map (natural flow from single-column layout).
- The `PostcodeMap` is always rendered (not conditional on `data`). Before search, it shows the default NL view. After search, it zooms to the area.
- Loading skeletons only appear in the left column.
- The existing `dynamic` import pattern for Leaflet (SSR avoidance) is preserved.

## Components Not Changed

These components remain as-is — no modifications needed:

- `PostcodeSearch.tsx`
- `QuickStats.tsx`
- `Amenities.tsx`
- `Migration.tsx`
- `HousingTypes.tsx`
- `ElectionResults.tsx`
- All API routes
- `lib/types.ts`, `lib/db.ts`, `lib/scraper.ts`

## Dependencies

No new npm packages needed:

- **Leaflet**: Already installed (1.9.4) — handles map, markers, popups
- **TopoJSON Client**: Already installed (3.1.0) — boundary rendering
- **Overpass API**: HTTP fetch, no library needed

## Error States

| Scenario | Behavior |
|----------|----------|
| TopoJSON load fails | Map shows tile layer only, no boundary, log error |
| Postcode not found in TopoJSON | Map stays on default NL view, show text error |
| Overpass API fails | Toggle buttons show "Could not load" tooltip, map works without POIs |
| Overpass returns empty | Toggle buttons work but no markers appear (expected for remote areas) |

## Performance Considerations

- TopoJSON file (1MB) is already fetched on search. No change here.
- Overpass queries are scoped to the area bounding box + small buffer, keeping response size small.
- POI results are cached in state — toggling doesn't re-fetch.
- Leaflet is already dynamically imported (code-split). No SSR issues.
