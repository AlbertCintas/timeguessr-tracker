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
