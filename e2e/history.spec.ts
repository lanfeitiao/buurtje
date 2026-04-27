import { test, expect, type Page } from "@playwright/test";

const KEY = "buurtje:search-history";

async function clearHistory(page: Page) {
  await page.goto("/history");
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
}

async function search(page: Page, q: string) {
  await page.goto("/");
  await page.fill('input[placeholder*="Postcode"]', q);
  await page.click('button[type="submit"]');
}

async function waitForResult(page: Page) {
  await expect(page.getByText(/Showing results for/i)).toBeVisible({ timeout: 30_000 });
}

// Badges on history rows are the only spans with the `.lowercase` class —
// safer than a substring text match because labels like "Zeestratenbuurt"
// also contain "buurt" / "wijk".
function badge(row: ReturnType<Page["locator"]>) {
  return row.locator("span.lowercase");
}

async function waitForError(page: Page) {
  await expect(
    page.getByText(/Not found|Network error|No data found/i)
  ).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await clearHistory(page);
});

test("1. Home page renders the History link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "History" })).toBeVisible();
});

test("2. /history empty state shows when there are no entries", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Search history" })).toBeVisible();
  await expect(page.getByText("No searches yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "home page" })).toBeVisible();
});

test("3. Postcode search lands in history with a postcode badge", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);

  await page.getByRole("link", { name: "History" }).click();
  const row = page.locator("li", { hasText: /1011/ }).first();
  await expect(row).toBeVisible();
  await expect(badge(row)).toHaveText("postcode");
});

test("4. Buurt search lands in history with a buurt badge", async ({ page }) => {
  // PDOK's top-ranked match for free-text queries is unpredictable, and
  // some buurts/wijks fall back to the underlying postcode in the UI
  // banner — so we read the saved entry straight from localStorage and
  // assert on its kind, then confirm the rendered row matches.
  await search(page, "Amsterdam Centrum");
  await waitForResult(page);

  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "[]"),
    KEY
  );
  expect(stored).toHaveLength(1);
  expect(["buurt", "wijk"]).toContain(stored[0].kind);

  await page.getByRole("link", { name: "History" }).click();
  const row = page.locator("li", { hasText: stored[0].label }).first();
  await expect(row).toBeVisible();
  await expect(badge(row)).toHaveText(stored[0].kind);
});

test("5. Tapping a history row re-runs the search", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);

  await page.goto("/history");
  await page.locator("li", { hasText: /1011/ }).first().click();

  await expect(page).toHaveURL(/\/\?q=1011/);
  await waitForResult(page);
});

test("6. Searching the same term twice yields a single history row (dedupe)", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);
  await search(page, "1011");
  await waitForResult(page);

  await page.goto("/history");
  const rows = page.locator("li", { hasText: /1011/ });
  await expect(rows).toHaveCount(1);
});

test("7. Per-row delete removes the entry and persists across reload", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);
  await search(page, "Amsterdam Centrum");
  await waitForResult(page);

  await page.goto("/history");
  await expect(page.locator("li")).toHaveCount(2);

  // Delete the postcode row
  const postcodeRow = page.locator("li", { hasText: /1011/ }).first();
  await postcodeRow.getByRole("button", { name: /Remove/ }).click();
  await expect(page.locator("li")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("li")).toHaveCount(1);
  await expect(page.locator("li", { hasText: /1011/ })).toHaveCount(0);
});

test("8. Clear all wipes history after confirm", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);
  await search(page, "Amsterdam Centrum");
  await waitForResult(page);

  await page.goto("/history");
  await expect(page.locator("li")).toHaveCount(2);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(page.getByText("No searches yet")).toBeVisible();
});

test("9. Failed search does not pollute history", async ({ page }) => {
  await search(page, "qwertyuiop");
  await waitForError(page);

  await page.goto("/history");
  await expect(page.getByText("No searches yet")).toBeVisible();
});

test("10. Postcode-fallback labels the row as the original area, not the postcode", async ({ page }) => {
  // Zeestratenbuurt (Amstelveen) is a buurt without polling stations of its own;
  // the home page falls back to its underlying postcode but history should
  // still show "buurt".
  await search(page, "Zeestratenbuurt Amstelveen");
  await waitForResult(page);

  await page.goto("/history");
  const row = page.locator("li", { hasText: /Zeestratenbuurt/i }).first();
  await expect(row).toBeVisible();
  await expect(badge(row)).toHaveText("buurt");
});

test("11. Cross-tab sync — deleting in tab A reflects in tab B after reload", async ({ context, page }) => {
  await search(page, "1011");
  await waitForResult(page);

  // Tab B opens /history and sees the entry
  const tabB = await context.newPage();
  await tabB.goto("/history");
  await expect(tabB.locator("li", { hasText: /1011/ })).toBeVisible();

  // Tab A deletes the entry via the data layer
  await page.evaluate((k) => localStorage.removeItem(k), KEY);

  // Tab B reloads and now sees the empty state
  await tabB.reload();
  await expect(tabB.getByText("No searches yet")).toBeVisible();
  await tabB.close();
});

test("12. Address search resolves to the buurt that contains it", async ({ page }) => {
  // "Damrak 1 Amsterdam" sits in PDOK's "Nieuwendijk-Noord" buurt.
  // Before the address→buurt change this would resolve to postcode 1012.
  // After: it should resolve to the buurt and the saved entry's kind
  // should be "buurt", with the address weergavenaam as the label.
  await search(page, "Damrak 1 Amsterdam");
  await waitForResult(page);

  // The matched-label line should show a buurt chip (not nothing/postcode).
  await expect(
    page.locator("p", { hasText: /^Matched:/ }).getByText(/^buurt$/)
  ).toBeVisible();

  // The saved history entry should be kind=buurt with the address as label.
  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "[]"),
    KEY
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].kind).toBe("buurt");
  expect(stored[0].label).toMatch(/Damrak 1.*Amsterdam/i);
});
