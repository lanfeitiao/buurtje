import { test, expect, type Page } from "@playwright/test";

const HISTORY_KEY = "buurtje:search-history";
const COMPARE_KEY = "buurtje:compare-set";

async function clearAllStorage(page: Page) {
  await page.goto("/history");
  await page.evaluate(
    ([h, c]) => {
      localStorage.removeItem(h);
      localStorage.removeItem(c);
    },
    [HISTORY_KEY, COMPARE_KEY]
  );
}

async function search(page: Page, q: string) {
  await page.goto("/");
  await page.fill('input[placeholder*="Postcode"]', q);
  await page.click('button[type="submit"]');
}

async function waitForResult(page: Page) {
  await expect(page.getByText(/Showing results for/i)).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await clearAllStorage(page);
});

test("1. Add two buurts from home, view comparison", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);
  await page.getByRole("button", { name: /Add to compare/ }).click();
  await expect(page.getByRole("button", { name: /Remove from compare/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Compare/ })).toContainText("1");

  await search(page, "1012");
  await waitForResult(page);
  await page.getByRole("button", { name: /Add to compare/ }).click();
  await expect(page.getByRole("link", { name: /^Compare/ })).toContainText("2");

  await page.getByRole("link", { name: /^Compare/ }).click();
  await expect(page).toHaveURL(/\/compare$/);

  // Two column headers should be present (postcodes 1011 and 1012)
  const headers = page.locator("h4");
  await expect(headers).toHaveCount(2);
});

test("2. Multi-select from history, view comparison", async ({ page }) => {
  await search(page, "1011");
  await waitForResult(page);
  await search(page, "1012");
  await waitForResult(page);
  await search(page, "1013");
  await waitForResult(page);

  await page.goto("/history");
  await expect(page.locator("li")).toHaveCount(3);

  await page.getByRole("button", { name: "Compare" }).click();
  await page.locator("li", { hasText: /1011/ }).first().click();
  await page.locator("li", { hasText: /1012/ }).first().click();

  await page.getByRole("button", { name: /Add to compare \(2\)/ }).click();
  await expect(page).toHaveURL(/\/compare$/);

  const headers = page.locator("h4");
  await expect(headers).toHaveCount(2);

  // Compare set should contain exactly the two queries
  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) || "[]"),
    COMPARE_KEY
  );
  expect(stored).toHaveLength(2);
  expect(stored.map((e: { query: string }) => e.query).sort()).toEqual(
    ["1011", "1012"].sort()
  );
});

test("3. Remove a column on /compare", async ({ page }) => {
  // Pre-seed three entries directly so the test isn't gated on PDOK
  await page.goto("/");
  await page.evaluate(
    ([k, value]) => {
      localStorage.setItem(k, value);
    },
    [
      COMPARE_KEY,
      JSON.stringify([
        { query: "1011", label: "1011", kind: "postcode", addedAt: 1 },
        { query: "1012", label: "1012", kind: "postcode", addedAt: 2 },
        { query: "1013", label: "1013", kind: "postcode", addedAt: 3 },
      ]),
    ]
  );

  await page.goto("/compare");
  await expect(page.locator("h4")).toHaveCount(3);
  // The chip on /compare itself is rendered as a non-navigating <span>.
  // Match by text rather than role so the assertion works on both forms.
  await expect(page.getByText(/^Compare\s*\d+$/).first()).toContainText("3");

  // Remove the middle column (1012)
  await page.getByRole("button", { name: "Remove 1012" }).click();

  await expect(page.locator("h4")).toHaveCount(2);
  await expect(page.locator("h4", { hasText: "1011" })).toBeVisible();
  await expect(page.locator("h4", { hasText: "1013" })).toBeVisible();
  await expect(page.locator("h4", { hasText: "1012" })).toHaveCount(0);
  await expect(page.getByText(/^Compare\s*\d+$/).first()).toContainText("2");
});
