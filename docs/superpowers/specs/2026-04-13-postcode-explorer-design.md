# Postcode Explorer — Design Spec

A minimalist website for house hunting in the Netherlands. Enter a 4-digit postcode, see key neighborhood data scraped from allecijfers.nl.

## Tech Stack

- **Next.js** (App Router) — single project for frontend + API
- **SQLite** (via `better-sqlite3`) — persistent cache for scraped data
- **Cheerio** — server-side HTML parsing of allecijfers.nl pages
- **Tailwind CSS** — styling

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser    │────▶│ /api/postcode/   │────▶│    SQLite DB     │
│  (Next.js)   │◀────│   [code]         │◀────│ postcode_data    │
└─────────────┘     └──────┬───────────┘     └──────────────────┘
                           │ cache miss
                           ▼
                    ┌──────────────────┐
                    │ allecijfers.nl   │
                    │ /postcode/{code} │
                    └──────────────────┘
```

### Data Flow

1. User enters 4-digit postcode, clicks Search (or presses Enter)
2. Frontend calls `GET /api/postcode/[code]`
3. API checks SQLite for cached data:
   - **Cache hit** → return stored JSON immediately
   - **Cache miss** → fetch `https://allecijfers.nl/postcode/{code}/`, parse with Cheerio, store in SQLite, return JSON
4. Frontend renders the data

### SQLite Schema

```sql
CREATE TABLE postcode_data (
  code TEXT PRIMARY KEY,
  data JSON NOT NULL,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

No auto-expiry — data is stored permanently once scraped.

### API Response Shape

```json
{
  "code": "1011",
  "location": "Amsterdam, Noord-Holland",
  "quickStats": {
    "wozValue": { "value": 588000, "year": 2023 },
    "avgIncome": { "value": 38200, "year": 2022 },
    "population": { "value": 9940, "year": 2025 },
    "households": { "value": 6670, "year": 2024 }
  },
  "amenities": {
    "supermarket": { "distance": 0.5, "unit": "km" },
    "gp": { "distance": 0.5, "unit": "km" },
    "primarySchool": { "distance": 0.6, "unit": "km" }
  },
  "migration": {
    "year": 2025,
    "breakdown": [
      { "origin": "Nederland", "count": 5010, "percentage": 50 },
      { "origin": "Europa", "count": 2170, "percentage": 22 },
      { "origin": "Overig", "count": 2760, "percentage": 28 }
    ]
  },
  "housingTypes": {
    "ownership": {
      "koop": 30,
      "huur": 70
    },
    "buildingType": {
      "flat": 85,
      "huis": 15
    }
  }
}
```

## UI Design

### Visual Style

- Light background (#f5f5f5)
- White cards with subtle border (#eee)
- Warm orange accent (#E65100) for highlights and key values
- System font stack (system-ui, -apple-system, sans-serif)
- Clean, card-based layout with generous spacing

### Page Layout

Single page, top to bottom:

#### 1. Header

- App name "POSTCODE EXPLORER" with orange dot accent
- 4-digit postcode input field (numeric only, max 4 chars)
- Search button (orange)
- After search: shows location name (e.g., "Postcodegebied 1011 - Amsterdam - Noord-Holland")

#### 2. Quick Stats Row

Four equal-width card tiles in a horizontal row:
- **Avg WOZ Value** — formatted as euro (e.g., "€588.000"), year label below
- **Avg Income** — euro amount per person, year label below
- **Population** — resident count, year label below
- **Households** — household count, year label below

Each tile: uppercase label (10px, grey), large value (22px, bold), small year note below.

#### 3. Nearest Amenities

Single card with three items in a horizontal row:
- **Supermarket** — icon + distance in orange
- **GP / Huisarts** — icon + distance in orange
- **Primary School** — icon + distance in orange

Each item: icon in light orange box, name label, bold distance value.

#### 4. Migration (Inwoners naar herkomst)

Single card containing:
- Section title with year
- Horizontal stacked bar (3 segments: Nederland #E65100, Europa #FF8A65, Overig #FFCCBC)
- Legend below with colored squares, labels, counts, and percentages

#### 5. Housing Types

Single card, two-column layout:
- **Left: Ownership** — horizontal bars for Koop vs Huur with percentages
- **Right: Building Type** — horizontal bars for Flat vs Huis with percentages

### States

- **Empty state**: Just the header with postcode input. No data sections visible.
- **Loading**: Skeleton/shimmer placeholders in place of data cards.
- **Error**: Inline message below the search bar (e.g., "Postcode not found" or "Could not fetch data").
- **Data loaded**: All sections visible with data.

### Responsive

- Desktop: 4-column quick stats, 3-column amenities, 2-column housing
- Mobile (<768px): stack everything vertically — 2-column quick stats, vertical amenities, single-column housing

## Scraping Strategy

### Target URL

`https://allecijfers.nl/postcode/{4-digit-code}/`

### Data Extraction (Cheerio selectors)

The page is structured with section headings and data tables/values. The scraper will:

1. Fetch the full HTML page
2. Parse with Cheerio
3. Extract data by finding section headings and their associated values
4. Key sections to parse:
   - **Nabijheid voorzieningen** → amenity distances
   - **Woningwaarde** → WOZ value
   - **Herkomst** → migration breakdown
   - **Woningeigendom / Soorten woningen** → housing types
   - **Inkomen** → income data
   - **Kerncijfers** → population, households

### Error Handling

- Invalid postcode (not 4 digits, or no data on allecijfers.nl) → 404 response
- allecijfers.nl unreachable → 502 response with retry message
- Parse failure (page structure changed) → 500 with logged error

## Project Structure

```
houseHounting/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main page with postcode input + data display
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind imports
│   │   └── api/
│   │       └── postcode/
│   │           └── [code]/
│   │               └── route.ts  # API route: check cache → scrape → return
│   ├── lib/
│   │   ├── scraper.ts            # Cheerio-based allecijfers.nl parser
│   │   └── db.ts                 # SQLite connection + queries
│   └── components/
│       ├── PostcodeSearch.tsx     # Search input + button
│       ├── QuickStats.tsx        # 4-tile stats row
│       ├── Amenities.tsx         # Nearest amenities card
│       ├── Migration.tsx         # Migration bar chart card
│       └── HousingTypes.tsx      # Housing types card
├── data/
│   └── postcodes.db              # SQLite database file (gitignored)
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Dependencies

- `next` — framework
- `react`, `react-dom` — UI
- `better-sqlite3` — SQLite driver (synchronous, fast)
- `@types/better-sqlite3` — types
- `cheerio` — HTML parsing
- `tailwindcss`, `postcss`, `autoprefixer` — styling
