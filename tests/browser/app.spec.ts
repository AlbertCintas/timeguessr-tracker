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
