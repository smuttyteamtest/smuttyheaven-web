import { devices, expect, test, type Page } from "@playwright/test";
import { API_ORIGIN, MockApi } from "./mock-api";

// Mirrors the frontend_handoff.md §9 smoke flow as a UI journey:
// browse → open novel → read chapter → register → favourite → progress →
// history → recommendations. All /api/** traffic is served by MockApi.

const NOVEL_TITLE = "Reincarnation Of The Strongest Sword God";

test.describe("smoke flow", () => {
  let mock: MockApi;

  test.beforeEach(async ({ page }) => {
    mock = new MockApi();
    await mock.install(page);
  });

  const forYouRail = (page: Page) =>
    page.locator("section.rail").filter({ hasText: "For you" });

  test("browse → read → register → favourite → progress → history → recommendations", async ({
    page,
  }) => {
    // ── 1. Home (logged out): featured hero + catalog rails ──────────────
    await page.goto("/");
    await expect(page).toHaveTitle("SmuttyHeaven — Read web novels");
    await expect(
      page.getByRole("heading", { name: /Explore worlds/ }),
    ).toBeVisible();
    const featured = page.getByLabel("Featured novels");
    await expect(featured).toBeVisible();
    // .first(): the cover fallback repeats the title inside the card
    await expect(featured.getByText(NOVEL_TITLE).first()).toBeVisible();
    // Personalized rails need a session
    await expect(page.getByText("Continue reading")).toHaveCount(0);
    await expect(forYouRail(page)).toHaveCount(0);

    // ── 2. Browse and search (debounced title search) ────────────────────
    await page.getByRole("link", { name: "All novels" }).click();
    await expect(page.getByText(/4 novels/)).toBeVisible();
    await page
      .getByLabel("Search novels by title")
      .fill("strongest sword god");
    await expect(page.getByText(/^1 novel$/)).toBeVisible();

    // ── 3. Novel detail: chapters listed in reading order ────────────────
    await page.getByRole("link", { name: new RegExp(NOVEL_TITLE) }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: NOVEL_TITLE }),
    ).toBeVisible();
    // Per-page title (issue #7)
    await expect(page).toHaveTitle(`${NOVEL_TITLE} — SmuttyHeaven`);
    await expect(page.getByText("3 chapters · added")).toBeVisible();
    const chapterRows = page.locator("ol.chapter-list li");
    await expect(chapterRows).toHaveCount(3);
    await expect(chapterRows.first()).toContainText("Chapter 1 - Starting Over");
    // Logged out — no list toggles yet
    await expect(
      page.getByRole("button", { name: "Favourite", exact: true }),
    ).toHaveCount(0);

    // ── 4. Read a chapter anonymously ────────────────────────────────────
    await page.getByRole("link", { name: /Start reading/ }).click();
    await expect(
      page.getByText("Shi Feng opened his eyes to a world he had left ten years ago."),
    ).toBeVisible();
    await expect(page.getByText("1 / 3")).toBeVisible();
    await expect(page).toHaveTitle(
      `Chapter 1 - Starting Over · ${NOVEL_TITLE} — SmuttyHeaven`,
    );

    // Arrow keys page between chapters (issue #7 a11y). Anonymous, so this
    // writes no progress and doesn't disturb the logged-in steps below.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 3")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1 / 3")).toBeVisible();

    // ── 5. Register ──────────────────────────────────────────────────────
    await page.getByRole("link", { name: "Sign up" }).click();
    await page.getByLabel("Username").fill("fe_smoke_1");
    await page.getByLabel("Email").fill("fe_smoke_1@example.com");
    await page.getByLabel("Password").fill("smoke-pass-1!");
    await page.getByLabel(/Display name/).fill("Smoke Tester");
    await page.getByRole("button", { name: "Sign up" }).click();

    // Redirected home with a live session
    await expect(page).toHaveURL("/");
    await expect(page.locator("header").getByText("Smoke Tester")).toBeVisible();
    // Cold start: recommendations are popularity-based
    await expect(forYouRail(page).getByText("Popular right now").first())
      .toBeVisible();

    // ── 6. Favourite the novel ───────────────────────────────────────────
    await page.goto("/novel/8757");
    const favourite = page.getByRole("button", { name: "Favourite", exact: true });
    await expect(favourite).toHaveAttribute("aria-pressed", "false");
    await favourite.click();
    const favourited = page.getByRole("button", { name: "Favourited" });
    await expect(favourited).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => mock.state("fe_smoke_1")!.lists.favourite.has(8757))
      .toBe(true);

    // ── 7. Read: progress saves on open, prev/next navigate by index ─────
    await page.getByRole("link", { name: /Start reading/ }).click();
    await expect(page.getByText("1 / 3")).toBeVisible();
    await expect
      .poll(() => mock.state("fe_smoke_1")!.progress.get(8757)?.chapterId)
      .toBe(334646);

    await page.getByRole("button", { name: "Next →" }).click();
    await expect(
      page.getByText("The Shadow Blade hummed with a familiar, forgotten power."),
    ).toBeVisible();
    await expect(page.getByText("2 / 3")).toBeVisible();
    await expect
      .poll(() => mock.state("fe_smoke_1")!.progress.get(8757)?.chapterId)
      .toBe(334647);

    // Back on the novel page, progress becomes the Continue button and the
    // current chapter is highlighted in the list
    await page.goto("/novel/8757");
    await expect(
      page.getByRole("link", { name: /Continue: Chapter 2 - Shadow Blade/ }),
    ).toBeVisible();
    await expect(
      page.locator("ol.chapter-list li.is-current"),
    ).toContainText("Chapter 2 - Shadow Blade");

    // ── 8. Library: favourites shelf + reading history ───────────────────
    await page.getByRole("link", { name: "My Library" }).click();
    await page.getByRole("tab", { name: "Favourites" }).click();
    await expect(
      page.getByRole("link", { name: new RegExp(NOVEL_TITLE) }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "History" }).click();
    const historyCard = page.getByRole("link", { name: new RegExp(NOVEL_TITLE) });
    await expect(historyCard).toBeVisible();
    await expect(historyCard).toContainText("Chapter 2 - Shadow Blade");

    // ── 9. Home again: continue-reading rail + personalized recs that
    //       exclude everything already collected/read ─────────────────────
    await page.goto("/");
    const continueRail = page
      .locator("section.rail")
      .filter({ hasText: "Continue reading" });
    await expect(continueRail.getByText(NOVEL_TITLE).first()).toBeVisible();
    await expect(
      continueRail.getByText("Chapter 2 - Shadow Blade"),
    ).toBeVisible();

    const forYou = forYouRail(page);
    await expect(
      forYou.getByText("Because you read Fantasy").first(),
    ).toBeVisible();
    await expect(forYou.getByText("Solo Leveling").first()).toBeVisible();
    await expect(forYou.getByText(NOVEL_TITLE)).toHaveCount(0);
  });

  test("expired session: any 401 logs the user out globally", async ({
    page,
  }) => {
    // Register through the UI to get a live session
    await page.goto("/register");
    await page.getByLabel("Username").fill("fe_smoke_2");
    await page.getByLabel("Email").fill("fe_smoke_2@example.com");
    await page.getByLabel("Password").fill("smoke-pass-2!");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.locator("header").getByText("fe_smoke_2")).toBeVisible();
    // Let the home rails render before rerouting to 401s — the header updates
    // before the mount fetches are issued, and a late rail request hitting
    // the 401 route would log the session out before the step below.
    await expect(
      forYouRail(page).getByText("Popular right now").first(),
    ).toBeVisible();

    // Simulate token expiry server-side, then hit a protected page
    await page.unroute(`${API_ORIGIN}/api/**`);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    await page.route(`${API_ORIGIN}/api/**`, (route) => {
      // Preflights must still succeed — a blocked preflight surfaces as a
      // network error, not the 401 we're testing.
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }
      return route.fulfill({
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
        body: JSON.stringify({ error: "Invalid or expired token" }),
      });
    });
    await page.getByRole("link", { name: "My Library" }).click();

    // Session is dropped: nav shows the logged-out state and the token is gone
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("novvels_token")))
      .toBeNull();
  });

  test("Completed tab lists only completed novels", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Completed" }).click();

    await expect(page).toHaveURL(/\/completed$/);
    await expect(
      page.getByRole("heading", { name: "Completed novels" }),
    ).toBeVisible();

    // The mock has exactly two completed novels; the ongoing/hiatus titles
    // must be filtered out server-side.
    await expect(page.getByText(/^2 novels$/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Godly Empress Doctor/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Solo Leveling/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(NOVEL_TITLE) }),
    ).toHaveCount(0);
  });
});

// Issue #7 reader niceties are touch-only (tap zones) or easiest to observe
// on a small viewport (scroll memory), so this suite runs as a phone.
test.describe("reader on mobile (issue #7)", () => {
  // defaultBrowserType can't change inside a describe group — drop it and
  // keep the rest of the phone profile (viewport, touch, UA).
  const { defaultBrowserType: _browser, ...pixel5 } = devices["Pixel 5"];
  test.use(pixel5);

  test.beforeEach(async ({ page }) => {
    await new MockApi().install(page);
  });

  test("remembers scroll position per chapter and pages via edge tap zones", async ({
    page,
  }) => {
    await page.goto("/novel/8757/read/334646");
    await expect(page.getByText("1 / 3")).toBeVisible();

    // Read deep into the chapter (content is padded tall in the mock)…
    await page.waitForFunction(
      () => document.body.scrollHeight > window.innerHeight * 2,
    );
    await page.evaluate(() => window.scrollTo({ top: 900 }));
    await expect
      .poll(() =>
        page.evaluate(() =>
          Number(sessionStorage.getItem("novvels_scroll_334646")),
        ),
      )
      .toBeGreaterThan(800);

    // …detour to the novel page and come back: position is restored.
    // dispatchEvent, not click(): Playwright's actionability pass scrolls the
    // sticky back-link's static position into view first, and the reader
    // would faithfully record that scroll as the new position.
    await page.getByLabel("Back to novel").dispatchEvent("click");
    await page.getByRole("link", { name: /Start reading/ }).click();
    await expect(page.getByText("1 / 3")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(800);

    // Edge tap zones page next/prev without the buttons.
    await page.locator(".reader-tapzone-next").tap();
    await expect(page.getByText("2 / 3")).toBeVisible();
    await page.locator(".reader-tapzone-prev").tap();
    await expect(page.getByText("1 / 3")).toBeVisible();
  });
});
