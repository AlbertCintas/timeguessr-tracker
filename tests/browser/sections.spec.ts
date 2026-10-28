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
  for (const name of ["Random game", "Add your score"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  const places = page.getByRole("navigation", { name: "Places" });
  await expect(places.getByRole("link", { name: "Club" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(places.getByRole("link", { name: "Atlas" })).toHaveAttribute(
    "href",
    "/timeguessr-tracker/atlas.html",
  );
  const daily = page.getByRole("link", { name: "Play daily" });
  await expect(daily).toBeVisible();
  await expect(daily).toHaveAttribute(
    "href",
    "https://timeguessr.com/play?mode=daily",
  );
  await expect(daily).toHaveAttribute("target", "_blank");
  for (const name of ["Browser extension", "Read the rules", "Sign in"])
    await expect(page.getByRole("button", { name })).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const menu = page.getByLabel("Account and settings");
  await menu.click();
  for (const name of ["Browser extension", "Read the rules"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await menu.click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

const answers = [
  [1904, "Denmark", "Crowds at the Craftsmen's Festival."],
  [1986, "USA", "A naval officer beside a cardboard Statue of Liberty."],
  [1986, "USA", null],
  [1989, "France", null],
  [2003, "UK", null],
].map(([year, country, description], i) => ({
  actual_year: year,
  actual_location: { lat: 40 + i, lng: -70 + i * 20 },
  country,
  description,
}));

async function serveAtlas(page: Page) {
  const game = { ...games[0], correct_answers: answers };
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    await route.fulfill({
      json: url.includes("/profiles")
        ? profiles
        : url.includes("/games")
          ? [game]
          : url.includes("/results")
            ? ["alice", "bob"].map((player_id, p) => ({
                game_id: game.id,
                player_id,
                points: 30000,
                rounds: rounds(p ? 2 : 0, p ? 900 : 100, p ? 2000 : 6000),
              }))
            : [],
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}

test("atlas tabs count each picture once per game, remember the tab and follow the period", async ({
  page,
}) => {
  await serveAtlas(page);
  await page.goto("./atlas.html");
  const tabs = page.getByRole("navigation", { name: "Atlas sections" });
  await expect(tabs.getByRole("button")).toHaveText([
    "Map",
    "Trivia",
    "Countries",
    "Years",
  ]);
  await expect(
    page.getByRole("img", { name: "Heat map of 5 pictures in 3° areas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Pictures per circle" }),
  ).toBeVisible();
  const zoom = page.getByRole("group", { name: "Map zoom" });
  await zoom.getByRole("button", { name: "Zoom in" }).click();
  await zoom.getByRole("button", { name: "Zoom in" }).click();
  await expect(
    page.getByRole("img", { name: "Heat map of 5 pictures in 1° areas" }),
  ).toBeVisible();
  await zoom.getByRole("button", { name: "Show the whole world" }).click();
  await expect(
    page.getByRole("img", { name: "Heat map of 5 pictures in 3° areas" }),
  ).toBeVisible();
  if (!test.info().project.name.includes("mobile")) {
    await page.getByRole("img", { name: /Heat map/ }).hover();
    await page.mouse.wheel(0, -1000);
    await expect(
      page.getByRole("img", { name: "Heat map of 5 pictures in 1° areas" }),
    ).toBeVisible();
  }

  await tabs.getByRole("button", { name: "Countries" }).click();
  await expect(page).toHaveURL(/#countries$/);
  await expect(
    page.getByText(
      "4 countries · 3 seen only once. Based on 5 pictures with a known country.",
    ),
  ).toBeVisible();
  const countries = page.getByRole("list", { name: "Pictures per country" });
  await expect(countries.getByRole("listitem")).toHaveCount(4);
  await expect(countries.getByRole("listitem").first()).toContainText("USA2");
  await expect(
    page.getByRole("list", { name: "Pictures per continent" }),
  ).toContainText("Europe3");

  await tabs.getByRole("button", { name: "Years" }).click();
  await expect(
    page.getByText("Based on 5 pictures with a known year."),
  ).toBeVisible();
  await expect(
    page.getByText("Gold: the most common year (2 pictures)."),
  ).toBeVisible();
  await expect(page.locator(".year-top text")).toHaveText(["1986"]);
  await expect(
    page.getByRole("listitem", {
      name: "1980s: 3 pictures · favourite decade",
    }),
  ).toContainText("±1");
  await expect(
    page.getByRole("img", { name: "Pictures per year from 1904 to 2003" }),
  ).toBeVisible();

  await tabs.getByRole("button", { name: "Trivia" }).click();
  await expect(
    page.getByText("Based on 5 pictures.", { exact: true }),
  ).toBeVisible();
  const oldest = page.locator(".trivia-fact", { hasText: "Oldest picture" });
  await expect(oldest).toContainText("1904");
  await oldest.getByRole("button", { name: "What the picture showed" }).focus();
  await expect(oldest.getByRole("tooltip")).toBeVisible();
  await expect(oldest.getByRole("tooltip")).toHaveText(
    "Crowds at the Craftsmen's Festival.",
  );
  await expect(
    page.locator(".trivia-fact", { hasText: "Biggest score gap" }),
  ).toContainText("4,000 pts apart");
  await expect(page.locator(".trivia-fact")).not.toContainText(["alice"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.reload();
  await expect(tabs.getByRole("button", { name: "Trivia" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByLabel("Standings period").selectOption("last7");
  await expect(
    page.getByText("No pictures captured in this period yet."),
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

test("backfilled answers show their country in history for games with only total scores", async ({
  page,
}) => {
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const game = {
      ...games[0],
      correct_answers: answers,
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
  await page.goto("./#history");
  await page.getByText("Daily · 08/10/26", { exact: true }).click();
  await page.getByText("Timeguessr’s correct answers", { exact: true }).click();
  const table = page.getByRole("table", {
    name: "Original photograph answers",
  });
  await expect(table).toContainText("1904");
  await expect(table).toContainText("Denmark");
  await expect(table).toContainText("40°, -70°");
  await expect(
    page.getByRole("link", { name: "Original Timeguessr game" }),
  ).toHaveAttribute("href", /timeguessr.com\/play/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
