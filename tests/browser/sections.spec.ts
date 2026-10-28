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
  await expect(fame.locator('[data-metric="complaints"]')).toContainText(
    "albertthegreatestLifetime achievementconstantly",
  );
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
  await expect(alice).toContainText("Closest guess12,500 m");
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
  await expect(fame.locator('[data-metric="closest"]')).toContainText(
    "12,500 m",
  );
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
