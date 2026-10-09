import { test, expect } from "@playwright/test";
const profiles = [
  { id: "alice", username: "alice", display_name: "Alice", avatar_path: null },
  { id: "bob", username: "bob", display_name: "Bob", avatar_path: null },
];
const games = [
  {
    id: "daily1",
    kind: "daily",
    daily_date: "2026-10-08",
    name: null,
    created_at: "2026-10-08T12:00:00Z",
  },
  {
    id: "daily2",
    kind: "daily",
    daily_date: "2026-10-09",
    name: null,
    created_at: "2026-10-09T12:00:00Z",
  },
];
test("unplayed history games link to complete challenge IDs and shared links become titles", async ({
  page,
}) => {
  const replayGames = Array.from({ length: 12 }, (_, index) => ({
    id: `replay-${index}`,
    kind: "custom",
    daily_date: null,
    name: `${index.toString(16).padStart(64, "0")}:${"b".repeat(32)}`,
    played_on: index === 0 ? "2023-06-01" : "2026-10-09",
    created_at: `2026-10-09T12:00:${String(59 - index).padStart(2, "0")}Z`,
  }));
  let createdTitle = "";
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    let data: unknown = [];
    if (url.includes("/auth/v1/token"))
      data = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "alice",
          aud: "authenticated",
          role: "authenticated",
          email: "alice@players.timeguessr.invalid",
        },
      };
    else if (url.includes("/profiles")) data = profiles;
    else if (url.includes("/games")) data = replayGames;
    else if (url.includes("/results"))
      data = [
        ...replayGames.map((game) => ({
          game_id: game.id,
          player_id: "bob",
          points: 30000,
        })),
        { game_id: replayGames[0].id, player_id: "alice", points: 0 },
      ];
    else if (url.includes("/rpc/get_or_create_game")) {
      createdTitle = route.request().postDataJSON().game_name;
      data = "new-game";
    } else if (url.includes("/administrators")) data = null;
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  await expect(page.locator(".history .game")).toHaveCount(10);
  await expect(page.locator(".history .game").first()).toContainText(
    replayGames[0].name,
  );
  await expect(page.locator(".game-play-link")).toHaveCount(0);
  const randomButton = page.getByRole("button", {
    name: "Play random unplayed game",
    exact: true,
  });
  await randomButton.click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const randomHelp = page.getByRole("button", {
    name: "How does random unplayed game work?",
  });
  await randomHelp.hover();
  await expect(page.getByRole("tooltip")).toContainText("club’s full history");
  await randomHelp.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.evaluate(() => {
    Math.random = () => 0.999;
    window.open = (url) => {
      document.body.dataset.openedGame = String(url);
      return null;
    };
  });
  await randomButton.click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-opened-game",
    `https://timeguessr.com/game-settings?RA=${encodeURIComponent(replayGames[11].name)}`,
  );
  await expect(page.locator(".game-play-link")).toHaveCount(9);
  await expect(
    page.locator(".history .game").first().locator(".game-play-link"),
  ).toHaveCount(0);
  const link = page.locator(".game-play-link").first();
  await expect(link).toHaveAttribute(
    "href",
    `https://timeguessr.com/game-settings?RA=${encodeURIComponent(replayGames[1].name)}`,
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Older games" }).click();
  await expect(page.locator(".history .game")).toHaveCount(2);
  await expect(page.locator(".game-play-link")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/private/tmp/timeguessr-replay-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add your score" }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Non-daily game", exact: true })
    .click();
  await page
    .getByLabel("Timeguessr game ID or link")
    .fill(
      `https://timeguessr.com/es/game-settings?RA=${encodeURIComponent(replayGames[1].name)}`,
    );
  await page.getByLabel("Final points").fill("10000");
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(createdTitle).toBe(replayGames[1].name);
});
test("leaderboards, independent fairness switches, history and login keyboard entry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("/profiles")
      ? profiles
      : url.includes("/games")
        ? games
        : url.includes("/results")
          ? [
              { game_id: "daily1", player_id: "alice", points: 40000 },
              { game_id: "daily2", player_id: "alice", points: 40000 },
              { game_id: "daily1", player_id: "bob", points: 45000 },
            ]
          : [];
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Most wins" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("summary").first()).toContainText(
    "Daily · 09/10/26",
  );
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const boards = page.locator(".board");
  await expect(boards.nth(1).locator(".player-row").first()).toContainText(
    "Alice",
  );
  await boards.nth(1).getByRole("switch").check();
  await expect(boards.nth(1).locator(".player-row").first()).toContainText(
    "Bob",
  );
  await expect(page.getByRole("heading", { name: "Most wins" })).toBeVisible();
  await boards.nth(0).getByRole("switch").check();
  await expect(boards.nth(0).locator(".player-row").first()).toContainText(
    "Bob",
  );
  await expect(boards.nth(0).locator(".player-row").first()).toContainText(
    "100.0%",
  );
  await page.locator("summary").first().click();
  await expect(page.locator(".game[open] .result")).toHaveCount(1);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).click();
  await page.keyboard.type("alice");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "alice",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `/private/tmp/timeguessr-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("score entry uses European dates and submits ISO dates", async ({
  page,
}) => {
  let submittedDate = "";
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    let data: unknown = [];
    if (url.includes("/auth/v1/token"))
      data = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "alice",
          aud: "authenticated",
          role: "authenticated",
          email: "alice@players.timeguessr.invalid",
        },
      };
    else if (url.includes("/profiles")) data = profiles;
    else if (url.includes("/rpc/get_or_create_game")) {
      submittedDate = route.request().postDataJSON().game_date;
      data = "new-game";
    } else if (url.includes("/administrators")) data = null;
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add your score" }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await expect(page.getByLabel("Challenge date", { exact: true })).toHaveValue(
    /^[0-9]{2}\/[0-9]{2}\/[0-9]{2}$/,
  );
  await page.getByLabel("Choose date from calendar").fill("2024-02-29");
  await expect(page.getByLabel("Challenge date", { exact: true })).toHaveValue(
    "29/02/24",
  );
  await page.getByLabel("Challenge date", { exact: true }).fill("31/02/24");
  await page.getByLabel("Final points").fill("12000");
  await page
    .getByRole("dialog")
    .locator('button[type="submit"], button.primary')
    .last()
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Enter a real date",
  );
  expect(submittedDate).toBe("");
  await page.getByLabel("Challenge date", { exact: true }).fill("29/02/24");
  await page
    .getByRole("dialog")
    .locator('button[type="submit"], button.primary')
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(submittedDate).toBe("2024-02-29");
});

test("history paginates newest first and clamps the page after games disappear", async ({
  page,
}) => {
  let count = 23;
  const historyGames = Array.from({ length: 24 }, (_, i) => ({
    id: `game-${i + 1}`,
    kind: "daily",
    daily_date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    name: null,
    created_at: `2026-09-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
  }));
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("/profiles")
      ? profiles
      : url.includes("/games")
        ? historyGames
        : url.includes("/results")
          ? historyGames
              .slice(0, count)
              .map((g) => ({ game_id: g.id, player_id: "alice", points: 100 }))
          : [];
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  const pagination = page.getByRole("navigation", {
    name: "Game history pagination",
  });
  await expect(page.locator(".game")).toHaveCount(10);
  await expect(page.locator("summary").first()).toContainText("23/09/26");
  await expect(page.locator("summary").last()).toContainText("14/09/26");
  await expect(
    pagination.getByRole("button", { name: "Newer games" }),
  ).toBeDisabled();
  await expect(pagination).toContainText("Page 1 of 3");
  await expect(page.locator(".board").first()).toContainText("23");
  await pagination.getByRole("button", { name: "Older games" }).click();
  await expect(page.locator(".game")).toHaveCount(10);
  await expect(page.locator("summary").first()).toContainText("13/09/26");
  await expect(page.locator("summary").last()).toContainText("04/09/26");
  await pagination.getByRole("button", { name: "Older games" }).click();
  await expect(page.locator(".game")).toHaveCount(3);
  await expect(page.locator("summary").first()).toContainText("03/09/26");
  await expect(
    pagination.getByRole("button", { name: "Older games" }),
  ).toBeDisabled();
  await pagination.getByRole("button", { name: "Newer games" }).click();
  await expect(pagination).toContainText("Page 2 of 3");
  await pagination.getByRole("button", { name: "Older games" }).click();
  count = 11;
  await page.getByRole("button", { name: "Refresh standings" }).click();
  await expect(pagination).toContainText("Page 2 of 2");
  await expect(page.locator(".game")).toHaveCount(1);
  await expect(page.locator("summary").first()).toContainText("01/09/26");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  count = 10;
  await page.getByRole("button", { name: "Refresh standings" }).click();
  await expect(pagination).toHaveCount(0);
  await expect(page.locator(".game")).toHaveCount(10);
  count = 0;
  await page.getByRole("button", { name: "Refresh standings" }).click();
  await expect(page.locator(".history-empty")).toBeVisible();
});

test("pasted detailed results save picture stats, populate shame rankings, and remain editable", async ({
  page,
}) => {
  const detailed = `TimeGuessr #1227 — 37,894/50,000
1️⃣ 🏆8,359 · 📅 7y · 🌍 1.3km
2️⃣ 🏆9,855 · 📅 0y · 🌍 11.3km
3️⃣ 🏆6,925 · 📅 11y · 🌍 3.5km
4️⃣ 🏆7,463 · 📅 10y · 🌍 1.1km
5️⃣ 🏆5,292 · 📅 17y · 🌍 208.2km
https://timeguessr.com`;
  let stored: Record<string, unknown>[] = [
    { game_id: "daily1", player_id: "bob", points: 1000 },
  ];
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = request.url();
    let data: unknown = [];
    if (url.includes("/auth/v1/token"))
      data = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "alice",
          aud: "authenticated",
          role: "authenticated",
          email: "alice@players.timeguessr.invalid",
        },
      };
    else if (url.includes("/profiles")) data = profiles;
    else if (url.includes("/games")) data = games;
    else if (url.includes("/rpc/get_or_create_game")) data = "daily2";
    else if (url.includes("/administrators")) data = null;
    else if (url.includes("/results")) {
      if (request.method() === "POST") stored.push(request.postDataJSON());
      if (request.method() === "PATCH")
        stored = stored.map((entry) =>
          entry.player_id === "alice"
            ? { ...entry, ...request.postDataJSON() }
            : entry,
        );
      data = stored;
    }
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add your score" }).click();
  await expect(
    page.getByRole("button", { name: "Paste results", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Final points")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save score", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Timeguessr share text").fill("broken text");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Couldn’t find",
  );
  await page.getByLabel("Timeguessr share text").fill(detailed);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "37,894 points",
  );
  await expect(page.getByLabel("Final points")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Read pasted results" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await expect(page.getByLabel("Final points")).toHaveValue("37894");
  await page
    .getByRole("button", { name: "Paste results", exact: true })
    .click();
  await page.getByLabel("Timeguessr share text").fill("invalid replacement");
  await expect(
    page.getByRole("button", { name: "Save score", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveCount(0);
  await page.getByLabel("Timeguessr share text").fill(detailed);
  await expect(page.getByRole("dialog").getByRole("table")).toContainText(
    "208.2",
  );
  await expect(page.getByRole("dialog")).toContainText("Timeguessr #1227");
  await page.getByLabel("Challenge date", { exact: true }).fill("09/10/26");
  await page.screenshot({
    path: `/private/tmp/timeguessr-import-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(stored[1].points).toBe(37894);
  expect(stored[1].daily_number).toBe(1227);
  expect(stored[1].rounds).toHaveLength(5);
  const shame = page.getByRole("table", { name: "Hall of shame records" });
  await expect(shame.locator("tbody tr")).toHaveCount(4);
  await expect(shame.locator('[data-metric="worstGame"]')).toContainText("Bob");
  await expect(shame.locator('[data-metric="distance"]')).toContainText(
    "Alice",
  );
  await expect(shame.locator('[data-metric="distance"]')).toContainText(
    "208.2",
  );
  await expect(shame.locator('[data-metric="years"]')).toContainText("17");
  await expect(shame.locator('[data-metric="zeros"]')).toHaveCount(0);
  await page.screenshot({
    path: `/private/tmp/timeguessr-shame-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.locator(".game > summary").first().click();
  await page.locator(".result-breakdown > summary").click();
  await expect(page.locator(".history .picture-breakdown")).toContainText(
    "9,855",
  );
  await page.getByRole("button", { name: "Edit Alice's score" }).click();
  await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  await page.getByLabel("Final points").fill("100");
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "total must match",
  );
  await page.getByRole("button", { name: "Remove picture details" }).click();
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(stored[1].rounds).toBeNull();
  expect(stored[1].points).toBe(100);
  await expect(shame.locator('[data-metric="zeros"]')).toHaveCount(0);
  await expect(shame.locator('[data-metric="worstGame"]')).toContainText(
    "Alice",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("zero-picture shame record appears only while a zero-point picture exists", async ({
  page,
}) => {
  let hasZero = false;
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const rounds = Array.from({ length: 5 }, (_, index) => ({
      points: hasZero && index === 0 ? 0 : 100,
      years_off: null,
      distance_km: null,
    }));
    const data = url.includes("/profiles")
      ? profiles
      : url.includes("/games")
        ? games
        : url.includes("/results")
          ? [
              {
                game_id: "daily1",
                player_id: "alice",
                points: hasZero ? 400 : 500,
                rounds,
              },
            ]
          : [];
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  const shame = page.getByRole("table", { name: "Hall of shame records" });
  await expect(shame.locator("tbody tr")).toHaveCount(4);
  await expect(shame.locator('[data-metric="zeros"]')).toHaveCount(0);
  hasZero = true;
  await page.getByRole("button", { name: "Refresh standings" }).click();
  await expect(shame.locator('[data-metric="zeros"]')).toContainText("Alice");
  await expect(shame.locator('[data-metric="zeros"]')).toContainText("1 zeros");
  hasZero = false;
  await page.getByRole("button", { name: "Refresh standings" }).click();
  await expect(shame.locator('[data-metric="zeros"]')).toHaveCount(0);
});

test("standings periods update both boards and their per-game denominators", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-09T12:00:00Z") });
  const periodGames = [
    "2026-09-30",
    "2026-10-05",
    "2026-10-06",
    "2026-10-09",
  ].map((date, i) => ({
    id: `period-${i}`,
    kind: "daily",
    daily_date: date,
    name: null,
    created_at: `${date}T12:00:00Z`,
  }));
  const periodResults = [
    { game_id: "period-0", player_id: "alice", points: 1000 },
    { game_id: "period-1", player_id: "bob", points: 600 },
    { game_id: "period-2", player_id: "alice", points: 400 },
    { game_id: "period-3", player_id: "alice", points: 300 },
  ];
  await page.route("https://club-test.supabase.co/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("/profiles")
      ? profiles
      : url.includes("/games")
        ? periodGames
        : url.includes("/results")
          ? periodResults
          : [];
    await route.fulfill({
      json: data,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("./");
  const picker = page.getByLabel("Standings period");
  const boards = page.locator(".boards .board");
  const alice = (board: number) =>
    boards.nth(board).locator(".player-row").filter({ hasText: "Alice" });
  const bob = (board: number) =>
    boards.nth(board).locator(".player-row").filter({ hasText: "Bob" });
  await expect(picker).toHaveValue("all");
  await expect(alice(1).locator(".score")).toHaveText("1,700");
  await picker.selectOption("week");
  await expect(alice(0).locator(".score")).toHaveText("2");
  await expect(alice(1).locator(".score")).toHaveText("700");
  await expect(alice(1).locator(".played")).toHaveText("2");
  await expect(boards.nth(0).locator(".board-foot")).toContainText("This week");
  await boards.nth(1).getByRole("switch").check();
  await expect(boards.nth(1).locator(".player-row").first()).toContainText(
    "Bob",
  );
  await expect(alice(1).locator(".score")).toHaveText("350");
  await boards.nth(0).getByRole("switch").check();
  await expect(alice(0).locator(".score")).toHaveText("100.0%");
  await picker.selectOption("today");
  await expect(alice(1).locator(".score")).toHaveText("300");
  await expect(bob(0)).toHaveCount(0);
  await expect(page.locator(".history .game")).toHaveCount(4);
  await picker.selectOption("month");
  await expect(alice(1).locator(".score")).toHaveText("350");
  await picker.selectOption("year");
  await expect(alice(1).locator(".played")).toHaveText("3");
  await picker.selectOption("last7");
  await expect(alice(1).locator(".played")).toHaveText("2");
  await picker.selectOption("last30");
  await expect(alice(1).locator(".played")).toHaveText("3");
  await boards.nth(1).getByRole("switch").uncheck();
  await picker.selectOption("all");
  await expect(alice(1).locator(".score")).toHaveText("1,700");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/private/tmp/timeguessr-periods-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("extension install button explains desktop installation and links to ZIP", async ({
  page,
}) => {
  await page.route("https://club-test.supabase.co/**", (route) =>
    route.fulfill({
      json: [],
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.goto("./");
  await page.getByRole("button", { name: "Install browser extension" }).click();
  const dialog = page.getByRole("dialog");
  const storeInstall = dialog.getByRole("button", {
    name: "Install in browser",
    exact: true,
  });
  await expect(storeInstall).toBeDisabled();
  await storeInstall.hover();
  await expect(dialog.getByRole("tooltip")).toContainText(
    "waiting for store approval",
  );
  await page.mouse.move(0, 0);
  await storeInstall.focus();
  await expect(dialog.getByRole("tooltip")).toContainText(
    "manual installation option below",
  );
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("tooltip")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  const pageUrl = page.url();
  await storeInstall.dispatchEvent("click");
  await expect(dialog.getByRole("tooltip")).toBeVisible();
  expect(page.url()).toBe(pageUrl);
  await expect(dialog).toContainText("Manual installation — Chrome / Edge");
  await expect(dialog).toContainText("Version 1.1.1");
  await expect(
    dialog.getByRole("link", { name: "Download Chrome / Edge extension ZIP" }),
  ).toHaveAttribute("download", "timeguessr-chrome-extension-1.1.1.zip");
  await expect(dialog).toContainText("Load unpacked");
  await expect(dialog).toContainText(
    "Mobile browsers cannot install this version",
  );
  await expect(
    dialog.getByRole("link", { name: "Download Chrome / Edge extension ZIP" }),
  ).toHaveAttribute(
    "href",
    "/timeguessr-tracker/downloads/timeguessr-chrome-extension-1.1.1.zip",
  );
  await expect(dialog).toContainText("chrome://extensions");
  await expect(dialog).toContainText("edge://extensions");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedAddress = text;
        },
      },
      configurable: true,
    });
  });
  for (const address of ["chrome://extensions", "edge://extensions"]) {
    await dialog
      .getByRole("button", { name: `Copy ${address}`, exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-copied-address",
      address,
    );
  }
  await expect(dialog.getByRole("status").first()).toContainText(
    "paste into the address bar",
  );

  await dialog
    .getByRole("link", { name: "Download Chrome / Edge extension ZIP" })
    .focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Firefox gets its own manual package and temporary installation instructions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 Firefox/140.0",
    });
  });
  await page.route("https://club-test.supabase.co/**", (route) =>
    route.fulfill({
      json: [],
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.goto("./");
  await page
    .getByRole("button", { name: "Install browser extension", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: "Download Firefox extension ZIP" }),
  ).toHaveAttribute(
    "href",
    "/timeguessr-tracker/downloads/timeguessr-firefox-extension-1.1.1.zip",
  );
  await expect(
    dialog.getByRole("link", { name: "Download Chrome / Edge extension ZIP" }),
  ).toHaveCount(0);
  await expect(dialog).toContainText("Load Temporary Add-on");
  await expect(dialog).toContainText("manifest.json");
  await expect(dialog).toContainText("After restarting Firefox, load it again");
  await expect(dialog).not.toContainText("Load unpacked");
});
