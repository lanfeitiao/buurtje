# Postcode Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimalist Next.js site where users enter a 4-digit Dutch postcode and see neighborhood data (WOZ, income, amenities, migration, housing types) scraped from allecijfers.nl with SQLite caching.

**Architecture:** Single Next.js app with API route that checks SQLite cache first, then scrapes allecijfers.nl on cache miss. Cheerio parses the HTML server-side. Frontend is a single page with card-based layout.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, better-sqlite3, Cheerio

---

## File Structure

```
houseHounting/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main page — search input + data display
│   │   ├── layout.tsx            # Root layout with metadata
│   │   ├── globals.css           # Tailwind imports
│   │   └── api/
│   │       └── postcode/
│   │           └── [code]/
│   │               └── route.ts  # GET handler: cache check → scrape → respond
│   ├── lib/
│   │   ├── scraper.ts            # Fetch + parse allecijfers.nl HTML
│   │   ├── db.ts                 # SQLite init, get, set
│   │   └── types.ts              # Shared PostcodeData type
│   └── components/
│       ├── PostcodeSearch.tsx     # Input + button
│       ├── QuickStats.tsx        # 4-tile row
│       ├── Amenities.tsx         # 3-item amenities card
│       ├── Migration.tsx         # Stacked bar + legend
│       └── HousingTypes.tsx      # Ownership + building type bars
├── __tests__/
│   ├── scraper.test.ts           # Scraper unit tests with fixture HTML
│   └── db.test.ts                # DB layer tests
├── __tests__/fixtures/
│   └── postcode-1011.html        # Saved HTML fixture for testing
├── data/                         # SQLite DB lives here (gitignored)
├── .gitignore
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/jianisong/Projects/houseHounting
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted, accept defaults. This creates the full project skeleton with Tailwind pre-configured.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install better-sqlite3 cheerio
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Create data directory and update .gitignore**

```bash
mkdir -p data
```

Append to `.gitignore`:

```
# SQLite database
data/*.db
data/*.db-journal
data/*.db-wal

# Superpowers brainstorm files
.superpowers/
```

- [ ] **Step 4: Verify the dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 with the default Next.js page.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create the PostcodeData type**

Create `src/lib/types.ts`:

```typescript
export interface PostcodeData {
  code: string;
  location: string;
  quickStats: {
    wozValue: { value: number; year: number };
    avgIncome: { value: number; year: number };
    population: { value: number; year: number };
    households: { value: number; year: number };
  };
  amenities: {
    supermarket: { distance: number; unit: string };
    gp: { distance: number; unit: string };
    primarySchool: { distance: number; unit: string };
  };
  migration: {
    year: number;
    breakdown: Array<{
      origin: string;
      count: number;
      percentage: number;
    }>;
  };
  housingTypes: {
    ownership: { koop: number; huur: number };
    buildingType: Record<string, number>;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add PostcodeData type definition"
```

---

### Task 3: SQLite Database Layer

**Files:**
- Create: `src/lib/db.ts`, `__tests__/db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/db.test.ts`:

```typescript
import { getPostcodeData, setPostcodeData, initDb } from "@/lib/db";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-postcodes.db");

beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  initDb(TEST_DB_PATH);
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

const sampleData = {
  code: "1011",
  location: "Amsterdam, Noord-Holland",
  quickStats: {
    wozValue: { value: 588000, year: 2023 },
    avgIncome: { value: 38200, year: 2022 },
    population: { value: 9940, year: 2025 },
    households: { value: 6670, year: 2024 },
  },
  amenities: {
    supermarket: { distance: 0.5, unit: "km" },
    gp: { distance: 0.5, unit: "km" },
    primarySchool: { distance: 0.6, unit: "km" },
  },
  migration: {
    year: 2025,
    breakdown: [
      { origin: "Nederland", count: 5010, percentage: 50 },
      { origin: "Europa", count: 2170, percentage: 22 },
      { origin: "Overig", count: 2760, percentage: 28 },
    ],
  },
  housingTypes: {
    ownership: { koop: 30, huur: 70 },
    buildingType: { appartement: 96, huis: 4 },
  },
};

describe("db", () => {
  test("returns null for unknown postcode", () => {
    const result = getPostcodeData("9999");
    expect(result).toBeNull();
  });

  test("stores and retrieves postcode data", () => {
    setPostcodeData("1011", sampleData);
    const result = getPostcodeData("1011");
    expect(result).toEqual(sampleData);
  });

  test("overwrites existing data for same postcode", () => {
    setPostcodeData("1011", sampleData);
    const updated = { ...sampleData, location: "Updated" };
    setPostcodeData("1011", updated);
    const result = getPostcodeData("1011");
    expect(result?.location).toBe("Updated");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/db.test.ts
```

If Jest is not configured yet, first add to `package.json`:

```bash
npm install -D jest ts-jest @types/jest
npx ts-jest config:init
```

Then update `jest.config.js` to handle `@/` path alias:

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

Run again:
```bash
npx jest __tests__/db.test.ts
```

Expected: FAIL — module `@/lib/db` not found.

- [ ] **Step 3: Implement db.ts**

Create `src/lib/db.ts`:

```typescript
import Database from "better-sqlite3";
import path from "path";
import { PostcodeData } from "./types";

let db: Database.Database;

export function initDb(
  dbPath: string = path.join(process.cwd(), "data", "postcodes.db")
): void {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS postcode_data (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      scraped_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function getDb(): Database.Database {
  if (!db) {
    initDb();
  }
  return db;
}

export function getPostcodeData(code: string): PostcodeData | null {
  const row = getDb()
    .prepare("SELECT data FROM postcode_data WHERE code = ?")
    .get(code) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as PostcodeData;
}

export function setPostcodeData(
  code: string,
  data: PostcodeData
): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO postcode_data (code, data) VALUES (?, ?)"
    )
    .run(code, JSON.stringify(data));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/db.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts __tests__/db.test.ts jest.config.js package.json package-lock.json
git commit -m "feat: add SQLite database layer with tests"
```

---

### Task 4: HTML Scraper

**Files:**
- Create: `src/lib/scraper.ts`, `__tests__/scraper.test.ts`, `__tests__/fixtures/postcode-1011.html`

- [ ] **Step 1: Save an HTML fixture**

Fetch and save the allecijfers.nl page for testing:

```bash
curl -o __tests__/fixtures/postcode-1011.html "https://allecijfers.nl/postcode/1011/"
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/scraper.test.ts`:

```typescript
import { parsePostcodePage } from "@/lib/scraper";
import fs from "fs";
import path from "path";

const html = fs.readFileSync(
  path.join(__dirname, "fixtures", "postcode-1011.html"),
  "utf-8"
);

describe("parsePostcodePage", () => {
  const result = parsePostcodePage("1011", html);

  test("extracts location name", () => {
    expect(result.code).toBe("1011");
    expect(result.location).toContain("Amsterdam");
  });

  test("extracts WOZ value", () => {
    expect(result.quickStats.wozValue.value).toBeGreaterThan(100000);
    expect(result.quickStats.wozValue.year).toBeGreaterThanOrEqual(2020);
  });

  test("extracts average income", () => {
    expect(result.quickStats.avgIncome.value).toBeGreaterThan(10000);
    expect(result.quickStats.avgIncome.year).toBeGreaterThanOrEqual(2020);
  });

  test("extracts population", () => {
    expect(result.quickStats.population.value).toBeGreaterThan(0);
  });

  test("extracts households", () => {
    expect(result.quickStats.households.value).toBeGreaterThan(0);
  });

  test("extracts amenity distances", () => {
    expect(result.amenities.supermarket.distance).toBeGreaterThan(0);
    expect(result.amenities.supermarket.unit).toBe("km");
    expect(result.amenities.gp.distance).toBeGreaterThan(0);
    expect(result.amenities.primarySchool.distance).toBeGreaterThan(0);
  });

  test("extracts migration breakdown", () => {
    expect(result.migration.breakdown.length).toBeGreaterThanOrEqual(3);
    const total = result.migration.breakdown.reduce(
      (sum, b) => sum + b.percentage,
      0
    );
    // Percentages should roughly sum to 100 (allow rounding)
    expect(total).toBeGreaterThanOrEqual(95);
    expect(total).toBeLessThanOrEqual(105);
  });

  test("extracts housing ownership", () => {
    const { koop, huur } = result.housingTypes.ownership;
    expect(koop + huur).toBeGreaterThanOrEqual(95);
    expect(koop + huur).toBeLessThanOrEqual(105);
  });

  test("extracts building types", () => {
    const types = result.housingTypes.buildingType;
    expect(Object.keys(types).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/scraper.test.ts
```

Expected: FAIL — `parsePostcodePage` not found.

- [ ] **Step 4: Implement the scraper**

Create `src/lib/scraper.ts`:

```typescript
import * as cheerio from "cheerio";
import { PostcodeData } from "./types";

function parseNumber(text: string): number {
  // Dutch formatting: "588.000" = 588000, "0,5" = 0.5, "46.600" = 46600
  const cleaned = text.replace(/[€\s%]/g, "").trim();
  // If it contains a comma, it's a decimal separator
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // Otherwise dots are thousand separators
  return parseInt(cleaned.replace(/\./g, ""), 10);
}

function parsePercentage(text: string): number {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function parsePostcodePage(code: string, html: string): PostcodeData {
  const $ = cheerio.load(html);

  // Helper: find a table row by label text and return the value cell
  function findRowValue(labelPattern: string): string {
    let value = "";
    $("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        if (label.toLowerCase().includes(labelPattern.toLowerCase())) {
          value = $(cells[1]).text().trim();
          return false; // break
        }
      }
    });
    return value;
  }

  function findRowYear(labelPattern: string): number {
    let year = 0;
    $("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        const label = $(cells[0]).text().trim();
        if (label.toLowerCase().includes(labelPattern.toLowerCase())) {
          year = parseInt($(cells[3]).text().trim(), 10);
          return false;
        }
      }
    });
    return year;
  }

  // Location: find "Gemeentenaam" row
  const gemeente = findRowValue("gemeentenaam") || "Unknown";
  const provincie = findRowValue("provincienaam") || "";
  const location = provincie ? `${gemeente}, ${provincie}` : gemeente;

  // Quick stats
  const wozText = findRowValue("gemiddelde woningwaarde");
  const wozYear = findRowYear("gemiddelde woningwaarde");
  const incomeText = findRowValue("gemiddeld inkomen per inwoner");
  const incomeYear = findRowYear("gemiddeld inkomen per inwoner");
  const popText = findRowValue("inwoners");
  const popYear = findRowYear("inwoners");
  const householdsText = findRowValue("huishoudens");
  const householdsYear = findRowYear("huishoudens");

  // Amenities
  const supermarketText = findRowValue("supermarkt afstand");
  const gpText = findRowValue("huisartsenpraktijk afstand");
  const schoolText = findRowValue("basisonderwijs afstand");

  // Migration — look for "Herkomst Nederland", "Herkomst Europa", "Herkomst buiten Europa"
  const nlCount = findRowValue("herkomst nederland");
  const euCount = findRowValue("herkomst europa");
  const nonEuCount = findRowValue("herkomst buiten europa");
  const nlPct = findRowValue("% herkomst nederland");
  const euPct = findRowValue("% herkomst europa");
  const nonEuPct = findRowValue("% herkomst buiten europa");
  const migrationYear = findRowYear("herkomst nederland");

  // Housing ownership
  const koopPct = findRowValue("% koopwoningen");
  const huurPct = findRowValue("% huurwoningen");

  // Building types
  const appartPct = findRowValue("% appartementen");
  const huisPct = findRowValue("% eengezinswoningen");

  return {
    code,
    location,
    quickStats: {
      wozValue: {
        value: parseNumber(wozText) || 0,
        year: wozYear || new Date().getFullYear(),
      },
      avgIncome: {
        value: parseNumber(incomeText) || 0,
        year: incomeYear || new Date().getFullYear(),
      },
      population: {
        value: parseNumber(popText) || 0,
        year: popYear || new Date().getFullYear(),
      },
      households: {
        value: parseNumber(householdsText) || 0,
        year: householdsYear || new Date().getFullYear(),
      },
    },
    amenities: {
      supermarket: {
        distance: parseNumber(supermarketText) || 0,
        unit: "km",
      },
      gp: {
        distance: parseNumber(gpText) || 0,
        unit: "km",
      },
      primarySchool: {
        distance: parseNumber(schoolText) || 0,
        unit: "km",
      },
    },
    migration: {
      year: migrationYear || new Date().getFullYear(),
      breakdown: [
        {
          origin: "Nederland",
          count: parseNumber(nlCount) || 0,
          percentage: parsePercentage(nlPct),
        },
        {
          origin: "Europa",
          count: parseNumber(euCount) || 0,
          percentage: parsePercentage(euPct),
        },
        {
          origin: "Overig",
          count: parseNumber(nonEuCount) || 0,
          percentage: parsePercentage(nonEuPct),
        },
      ],
    },
    housingTypes: {
      ownership: {
        koop: parsePercentage(koopPct),
        huur: parsePercentage(huurPct),
      },
      buildingType: {
        appartement: parsePercentage(appartPct),
        huis: parsePercentage(huisPct),
      },
    },
  };
}

export async function scrapePostcode(code: string): Promise<PostcodeData> {
  const url = `https://allecijfers.nl/postcode/${code}/`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch postcode ${code}: ${response.status}`);
  }

  const html = await response.text();
  return parsePostcodePage(code, html);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/scraper.test.ts
```

Expected: All tests PASS. If any tests fail due to HTML structure differences, adjust the `findRowValue` label patterns to match the actual HTML in the fixture file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scraper.ts __tests__/scraper.test.ts __tests__/fixtures/postcode-1011.html
git commit -m "feat: add allecijfers.nl HTML scraper with tests"
```

---

### Task 5: API Route

**Files:**
- Create: `src/app/api/postcode/[code]/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/postcode/[code]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getPostcodeData, setPostcodeData } from "@/lib/db";
import { scrapePostcode } from "@/lib/scraper";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Validate: must be exactly 4 digits
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { error: "Invalid postcode. Must be 4 digits." },
      { status: 400 }
    );
  }

  // Check cache
  const cached = getPostcodeData(code);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Scrape
  try {
    const data = await scrapePostcode(code);
    setPostcodeData(code, data);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    if (message.includes("404")) {
      return NextResponse.json(
        { error: `Postcode ${code} not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch data. Please try again later." },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Test manually**

Start the dev server and test:

```bash
npm run dev
# In another terminal:
curl http://localhost:3000/api/postcode/1011
```

Expected: JSON response with postcode data. Second request should return cached data instantly.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/postcode/\[code\]/route.ts
git commit -m "feat: add /api/postcode/[code] API route with caching"
```

---

### Task 6: Frontend Components

**Files:**
- Create: `src/components/PostcodeSearch.tsx`, `src/components/QuickStats.tsx`, `src/components/Amenities.tsx`, `src/components/Migration.tsx`, `src/components/HousingTypes.tsx`

- [ ] **Step 1: Create PostcodeSearch component**

Create `src/components/PostcodeSearch.tsx`:

```tsx
"use client";

import { useState } from "react";

interface PostcodeSearchProps {
  onSearch: (code: string) => void;
  isLoading: boolean;
}

export default function PostcodeSearch({
  onSearch,
  isLoading,
}: PostcodeSearchProps) {
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length === 4) {
      onSearch(code);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-center">
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="1011"
        className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-xl font-medium text-gray-800 w-32 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
      />
      <button
        type="submit"
        disabled={code.length !== 4 || isLoading}
        className="bg-[#E65100] text-white rounded-lg px-5 py-3 text-sm font-medium hover:bg-[#BF360C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Loading..." : "Search"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create QuickStats component**

Create `src/components/QuickStats.tsx`:

```tsx
import { PostcodeData } from "@/lib/types";

interface QuickStatsProps {
  data: PostcodeData;
}

function formatEuro(value: number): string {
  return "€" + value.toLocaleString("nl-NL");
}

function formatNumber(value: number): string {
  return value.toLocaleString("nl-NL");
}

export default function QuickStats({ data }: QuickStatsProps) {
  const stats = [
    {
      label: "Avg WOZ Value",
      value: formatEuro(data.quickStats.wozValue.value),
      year: data.quickStats.wozValue.year,
    },
    {
      label: "Avg Income",
      value: formatEuro(data.quickStats.avgIncome.value),
      year: data.quickStats.avgIncome.year,
    },
    {
      label: "Population",
      value: formatNumber(data.quickStats.population.value),
      year: data.quickStats.population.year,
    },
    {
      label: "Households",
      value: formatNumber(data.quickStats.households.value),
      year: data.quickStats.households.year,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl p-4 border border-gray-100"
        >
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">
            {stat.label}
          </div>
          <div className="text-xl font-bold text-gray-800 mt-1">
            {stat.value}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">{stat.year}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Amenities component**

Create `src/components/Amenities.tsx`:

```tsx
import { PostcodeData } from "@/lib/types";

interface AmenitiesProps {
  data: PostcodeData;
}

export default function Amenities({ data }: AmenitiesProps) {
  const items = [
    {
      icon: "🛒",
      name: "Supermarket",
      distance: data.amenities.supermarket.distance,
    },
    { icon: "🏥", name: "GP / Huisarts", distance: data.amenities.gp.distance },
    {
      icon: "🏫",
      name: "Primary School",
      distance: data.amenities.primarySchool.distance,
    },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        Nearest Amenities
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center text-base">
              {item.icon}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">
                {item.name}
              </div>
              <div className="text-lg font-bold text-[#E65100]">
                {item.distance} km
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Migration component**

Create `src/components/Migration.tsx`:

```tsx
import { PostcodeData } from "@/lib/types";

interface MigrationProps {
  data: PostcodeData;
}

const COLORS = ["#E65100", "#FF8A65", "#FFCCBC"];

export default function Migration({ data }: MigrationProps) {
  const { breakdown, year } = data.migration;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        Migration — Inwoners naar herkomst{" "}
        <span className="text-gray-400 font-normal">({year})</span>
      </h3>
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        {breakdown.map((item, i) => (
          <div
            key={item.origin}
            style={{
              width: `${item.percentage}%`,
              backgroundColor: COLORS[i],
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {breakdown.map((item, i) => (
          <div key={item.origin} className="flex items-center gap-1.5 text-sm">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[i] }}
            />
            <span className="text-gray-500">{item.origin}</span>
            <span className="font-semibold text-gray-800">
              {item.count.toLocaleString("nl-NL")} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create HousingTypes component**

Create `src/components/HousingTypes.tsx`:

```tsx
import { PostcodeData } from "@/lib/types";

interface HousingTypesProps {
  data: PostcodeData;
}

function Bar({
  label,
  percentage,
  color,
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-1.5">
      <div className="flex-1 bg-gray-100 rounded h-2 overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 min-w-[80px]">
        {label} {percentage}%
      </span>
    </div>
  );
}

export default function HousingTypes({ data }: HousingTypesProps) {
  const { ownership, buildingType } = data.housingTypes;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        Housing Types
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">
            Ownership
          </div>
          <Bar label="Koop" percentage={ownership.koop} color="#E65100" />
          <Bar label="Huur" percentage={ownership.huur} color="#FF8A65" />
        </div>
        <div>
          <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">
            Building Type
          </div>
          {Object.entries(buildingType).map(([type, pct], i) => (
            <Bar
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              percentage={pct}
              color={i === 0 ? "#E65100" : "#FF8A65"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add all frontend data display components"
```

---

### Task 7: Main Page

**Files:**
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Update the root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postcode Explorer",
  description: "Neighborhood data for Dutch postcodes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Build the main page**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PostcodeData } from "@/lib/types";
import PostcodeSearch from "@/components/PostcodeSearch";
import QuickStats from "@/components/QuickStats";
import Amenities from "@/components/Amenities";
import Migration from "@/components/Migration";
import HousingTypes from "@/components/HousingTypes";

export default function Home() {
  const [data, setData] = useState<PostcodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(code: string) {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/postcode/${code}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-2 h-2 bg-[#E65100] rounded-full" />
          <span className="text-sm font-semibold tracking-wide text-gray-800">
            POSTCODE EXPLORER
          </span>
        </div>
        <PostcodeSearch onSearch={handleSearch} isLoading={isLoading} />
        {data && (
          <p className="mt-2 text-sm text-gray-400">
            Postcodegebied {data.code} · {data.location}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"
            >
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Data sections */}
      {data && (
        <div className="space-y-4">
          <QuickStats data={data} />
          <Amenities data={data} />
          <Migration data={data} />
          <HousingTypes data={data} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Start dev server and test in browser**

```bash
npm run dev
```

Open http://localhost:3000 in a browser:
1. Verify the search input and button appear
2. Enter `1011` and click Search
3. Verify all 4 data sections appear with real data
4. Enter an invalid code (e.g., `0000`) and verify error message appears
5. Test responsive layout by narrowing the browser window

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: build main page with all data sections"
```

---

### Task 8: Polish & Final Verification

- [ ] **Step 1: Add .gitignore entry for data dir if missing**

Verify `.gitignore` includes `data/*.db`. If not, add it.

- [ ] **Step 2: Run the full test suite**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 3: Test with a different postcode**

Open the browser, search for `2611` (Delft) to verify scraping works for a different area. Verify data populates correctly.

- [ ] **Step 4: Test cached response**

Search for `1011` again — should return instantly (from SQLite cache). Check the `data/postcodes.db` file exists.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: postcode explorer complete — scraping, caching, UI"
```
