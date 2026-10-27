import { test, expect, type Page } from "@playwright/test";
const profiles = [
  { id: "alice", username: "alice", display_name: "Alice", avatar_path: null },
  { id: "bob", username: "bob", display_name: "Bob", avatar_path: null },
];
const games = [8, 9, 10, 11].map((day) => ({
  id: `daily${day}`,
  kind: "daily",
  daily_date: `2026-10-${String(day).padStart(2, "0")}`,
  name: null,
  created_at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
}));
const rounds = (years: number, km: number, points = 6000) =>
  Array.from({ length: 5 }, () => ({
    points,
    years_off: years,
    distance_km: km,
  }));

async function serve(page: Page, aliceGames: number) {
  const results = games.flatMap((game, index) => [
    ...(index < aliceGames
      ? [
          {
            game_id: game.id,
            player_id: "alice",
            points: 30000 + index,
            rounds: rounds(index === 0 ? 0 : 4, 12.5, index ? 6000 : 10000),
          },
        ]
      : []),
    { game_id: game.id, player_id: "bob", points: 20000 },
  ]);
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("/profiles")
      ? profiles
      : url.includes("/games")
        ? games
        : url.includes("/results")
          ? results
          : [];
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}

test("tabs show one section at a time and remember it in the URL", async ({
  page,
}) => {
  await serve(page, 4);
  await page.goto("./");
  const sections = page.getByRole("navigation", { name: "Sections" });
  await expect(
    sections.getByRole("button", { name: "Standings" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Win percentage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Hall of shame records" }),
  ).toHaveCount(0);
  await sections.getByRole("button", { name: "Hall of fame" }).click();
  await expect(page).toHaveURL(/#fame$/);
  const fame = page.getByRole("table", { name: "Hall of fame records" });
  await expect(fame.locator('[data-metric="avgYears"]')).toContainText("Alice");
  await expect(fame.locator('[data-metric="avgYears"]')).toContainText(
    "3 years avg",
  );
  await expect(fame.locator('[data-metric="avgDistance"]')).toContainText(
    "12.5 km avg",
  );
  await expect(fame.locator('[data-metric="exactYears"]')).toContainText(
    "5 exact",
  );
  await expect(fame.locator('[data-metric="perfect"]')).toContainText(
    "5 perfect",
  );
  await expect(fame.locator('[data-metric="streak"]')).toContainText("4 days");
  await expect(fame.locator('[data-metric="bestGame"]')).toContainText(
    "Daily · 11/10/26",
  );
  await expect(page.getByText("All time records")).toBeVisible();
  await page.getByLabel("Standings period").selectOption("last7");
  await expect(fame.locator('[data-metric="bestGame"]')).toContainText(
    "No scores yet",
  );
  await expect(page.getByText("Last 7 days records")).toBeVisible();
  await page.getByLabel("Standings period").selectOption("all");
  await page.screenshot({
    path: `/private/tmp/timeguessr-lab-tabs-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(fame).toBeVisible();
  await expect(sections.getByRole("button")).toHaveText([
    "Standings",
    "Hall of shame",
    "Hall of fame",
    "Player stats",
    "Featured pictures",
    "History",
  ]);
  await sections.getByRole("button", { name: "Hall of shame" }).click();
  const shame = page.getByRole("table", { name: "Hall of shame records" });
  await expect(shame.locator('[data-metric="worstGame"]')).toContainText("Bob");
  await expect(shame.locator('[data-metric="avgYears"]')).toContainText(
    "3 years avg",
  );
  await expect(shame.locator('[data-metric="worstGame"]')).toContainText(
    "A five-picture cry for help.",
  );
  await expect(shame.locator('[data-metric="years"]')).toContainText(
    "Carbon dating, but drunk.",
  );
  await expect
    .poll(() =>
      shame
        .locator("tbody tr")
        .evaluateAll((rows) => rows.map((row) => row.dataset.metric)),
    )
    .toEqual([
      "avgYears",
      "avgDistance",
      "years",
      "distance",
      "worstGame",
      "worstPicture",
    ]);
  await page.getByLabel("Standings period").selectOption("last7");
  await expect(shame.locator('[data-metric="worstGame"]')).toContainText(
    "No scores yet",
  );
  await expect(page.getByText("Last 7 days records")).toBeVisible();
  await page.getByLabel("Standings period").selectOption("all");
  await sections.getByRole("button", { name: "Player stats" }).click();
  const alice = page.getByRole("article", { name: "Alice stats" });
  await expect(alice).toContainText("Games4");
  await expect(alice).toContainText("Exact years5");
  await expect(alice).toContainText("Average distance12.5 km");
  await expect(page.getByRole("article", { name: "Bob stats" })).toContainText(
    "Detailed pictures0",
  );
  await page.screenshot({
    path: `/private/tmp/timeguessr-lab-stats-${test.info().project.name}.png`,
    fullPage: true,
  });
  await sections.getByRole("button", { name: "History" }).click();
  await expect(
    page.getByRole("heading", { name: /Game history/ }),
  ).toBeVisible();
  await expect(fame).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("average records stay empty below 20 detailed pictures", async ({
  page,
}) => {
  await serve(page, 3);
  await page.goto("./#fame");
  const fame = page.getByRole("table", { name: "Hall of fame records" });
  await expect(fame.locator('[data-metric="avgYears"]')).toContainText(
    "Nobody has 20 detailed pictures yet",
  );
  await expect(fame.locator('[data-metric="closest"]')).toContainText("Alice");
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("button", { name: "Hall of shame" })
    .click();
  const shame = page.getByRole("table", { name: "Hall of shame records" });
  await expect(shame.locator('[data-metric="avgDistance"]')).toContainText(
    "Nobody has 20 detailed pictures yet",
  );
  await expect(page.getByRole("button", { name: /Sidebar/ })).toHaveCount(0);
});

test("the top bar shows the helpers and keeps account controls in a menu", async ({
  page,
}) => {
  await serve(page, 4);
  await page.goto("./");
  for (const name of [
    "Random game",
    "Browser extension",
    "Read the rules",
    "Add your score",
  ])
    await expect(page.getByRole("button", { name })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Play Timeguessr/ }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const menu = page.getByLabel("Account and settings");
  await menu.click();
  await expect(
    page.getByRole("link", { name: /Play Timeguessr/ }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await menu.click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("featured answers count once per game, show heatmap and year bars, and filter with the period", async ({
  page,
}) => {
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const answers = rounds(0, 0).map((r, i) => ({
      ...r,
      actual_year: i === 0 ? 1990 : 2000,
      actual_location: { lat: 48.8, lng: 2.3 },
    }));
    await route.fulfill({
      json: url.includes("/profiles")
        ? profiles
        : url.includes("/games")
          ? games.slice(0, 1)
          : url.includes("/results")
            ? ["alice", "bob"].map((player_id) => ({
                game_id: games[0].id,
                player_id,
                points: 30000,
                rounds: answers,
              }))
            : [],
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./#featured");
  await expect(
    page.getByRole("heading", { name: "Featured pictures", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("5 mapped · 5 dated · 5 pictures.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Location heatmap of 5 featured pictures" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "1990: 1 pictures" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "2000: 4 pictures" }),
  ).toBeVisible();
  await page.getByText("Location counts", { exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Featured locations by geographic cell" }),
  ).toContainText("45° to 50°");
  await page.screenshot({
    path: `../featured-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Standings period").selectOption("last7");
  await expect(
    page.getByText("No correct years captured in this period yet."),
  ).toBeVisible();
  await expect(
    page.getByText("No correct locations captured in this period yet."),
  ).toBeVisible();
});

test("correct answers appear in history without overflowing a mobile page", async ({
  page,
}) => {
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const answers = rounds(0, 0).map((r) => ({
      ...r,
      actual_year: 1990,
      actual_location: { lat: 48.8, lng: 2.3 },
    }));
    await route.fulfill({
      json: url.includes("/profiles")
        ? profiles
        : url.includes("/games")
          ? games.slice(0, 1)
          : url.includes("/results")
            ? [
                {
                  game_id: games[0].id,
                  player_id: "alice",
                  points: 30000,
                  rounds: answers,
                },
              ]
            : [],
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./#history");
  await page.getByText("Daily · 08/10/26", { exact: true }).click();
  await page.getByText("Alice’s picture breakdown", { exact: true }).click();
  const table = page.getByRole("table", { name: "Picture breakdown" });
  await expect(table).toContainText("Correct year");
  await expect(table).toContainText("1990");
  await expect(table).toContainText("48.8°, 2.3°");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("automatic site backfill fills charts and history for games with only total scores", async ({
  page,
}) => {
  const originalAnswers = Array.from({ length: 5 }, () => ({
    actual_year: 1986,
    actual_location: { lat: 40.7663, lng: -73.9798 },
  }));
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const game = {
      ...games[0],
      correct_answers: originalAnswers,
      answers_source_url:
        "https://timeguessr.com/play?mode=daily&archive=1227-c4325922368acb2a08bd",
    };
    await route.fulfill({
      json: url.includes("/profiles")
        ? profiles
        : url.includes("/games")
          ? [game]
          : url.includes("/results")
            ? ["alice", "bob"].map((player_id) => ({
                game_id: game.id,
                player_id,
                points: 30000,
              }))
            : [],
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./#featured");
  await expect(
    page.getByText("5 mapped · 5 dated · 5 pictures.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: "1986: 5 pictures" }),
  ).toBeVisible();
  await page.getByLabel("Standings period").selectOption("last7");
  await expect(
    page.getByText("No correct years captured in this period yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Daily · 08/10/26", { exact: true }).click();
  await page.getByText("Timeguessr’s correct answers", { exact: true }).click();
  const answers = page.getByRole("table", {
    name: "Original photograph answers",
  });
  await expect(answers).toContainText("1986");
  await expect(answers).toContainText("40.7663°, -73.9798°");
  await expect(
    page.getByRole("link", { name: "Original Timeguessr game" }),
  ).toHaveAttribute("href", /timeguessr.com\/play/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
