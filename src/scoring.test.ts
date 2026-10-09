import { test } from "node:test";
import assert from "node:assert/strict";
import {
  madridToday,
  ranked,
  standings,
  europeanDate,
  parseEuropeanDate,
  resultsForPeriod,
  type StandingsPeriod,
} from "./scoring.ts";
import type { Game } from "./types.ts";
const profiles = ["a", "b", "c"].map((id) => ({
  id,
  username: id,
  display_name: id,
  avatar_path: null,
}));
test("totals, tied winners, and one-submission games", () => {
  const rows = standings(profiles, [
    { game_id: "1", player_id: "a", points: 100 },
    { game_id: "1", player_id: "b", points: 100 },
    { game_id: "2", player_id: "a", points: 50 },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.games, r.wins, r.points, r.winRate, r.average]),
    [
      [2, 2, 150, 100, 75],
      [1, 1, 100, 100, 100],
      [0, 0, 0, 0, 0],
    ],
  );
});
test("late submissions, edits, and deletes recalculate wins", () => {
  let results = [{ game_id: "1", player_id: "a", points: 10 }];
  assert.equal(standings(profiles, results)[0].wins, 1);
  results.push({ game_id: "1", player_id: "b", points: 20 });
  assert.equal(standings(profiles, results)[0].wins, 0);
  results[0].points = 30;
  assert.equal(standings(profiles, results)[0].wins, 1);
  results = results.filter((r) => r.player_id !== "a");
  assert.equal(standings(profiles, results)[1].wins, 1);
});
test("relative rankings reward averages, preserve tied ranks, and exclude unplayed players", () => {
  const rows = standings(profiles, [
    { game_id: "1", player_id: "a", points: 10 },
    { game_id: "2", player_id: "a", points: 10 },
    { game_id: "1", player_id: "b", points: 15 },
  ]);
  assert.equal(ranked(rows, "points")[0].id, "a");
  assert.equal(ranked(rows, "average")[0].id, "b");
  const tied = standings(profiles, [
    { game_id: "1", player_id: "a", points: 0 },
    { game_id: "1", player_id: "b", points: 0 },
  ]);
  assert.deepEqual(
    ranked(tied, "points").map((r) => r.rank),
    [1, 1, null],
  );
});
test("daily dates use Madrid midnight including daylight saving", () => {
  assert.equal(madridToday(new Date("2026-10-08T22:30:00Z")), "2026-10-09");
  assert.equal(madridToday(new Date("2026-12-08T22:30:00Z")), "2026-12-08");
});

test("European dates round-trip and reject impossible or ambiguous input", () => {
  assert.equal(europeanDate("2026-10-09"), "09/10/26");
  assert.equal(parseEuropeanDate("09/10/26"), "2026-10-09");
  assert.equal(parseEuropeanDate("29/02/24"), "2024-02-29");
  for (const value of [
    "29/02/25",
    "31/04/26",
    "32/01/26",
    "01/13/26",
    "00/01/26",
    "1/2/26",
    "2026-10-09",
    "09/10/2026",
    "",
  ])
    assert.equal(parseEuropeanDate(value), null);
});

test("standings periods filter by challenge date, Madrid dates and Monday-based calendar weeks", () => {
  const dates = [
    "2025-12-31",
    "2026-01-01",
    "2026-09-09",
    "2026-09-10",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-09",
    "2026-10-10",
  ];
  const games: Game[] = dates.map((date) => ({
    id: date,
    kind: "daily",
    daily_date: date,
    name: null,
    created_at: "2026-10-09T12:00:00Z",
  }));
  games.push(
    {
      id: "customToday",
      kind: "custom",
      daily_date: null,
      name: "night",
      created_at: "2026-10-08T22:30:00Z",
    },
    {
      id: "customYesterday",
      kind: "custom",
      daily_date: null,
      name: "evening",
      created_at: "2026-10-08T21:30:00Z",
    },
  );
  const results = games.map((game) => ({
    game_id: game.id,
    player_id: "a",
    points: 100,
  }));
  const now = new Date("2026-10-09T12:00:00Z");
  const ids = (period: StandingsPeriod) =>
    resultsForPeriod(games, results, period, now).map((row) => row.game_id);
  assert.equal(resultsForPeriod(games, results, "all", now), results);
  assert.deepEqual(ids("today"), ["2026-10-09", "customToday"]);
  assert.deepEqual(ids("week"), [
    "2026-10-05",
    "2026-10-09",
    "customToday",
    "customYesterday",
  ]);
  assert.deepEqual(ids("month"), [
    ...dates.slice(5, 11),
    "customToday",
    "customYesterday",
  ]);
  assert.deepEqual(ids("year"), [
    ...dates.slice(1, 11),
    "customToday",
    "customYesterday",
  ]);
  assert.deepEqual(ids("last7"), [
    ...dates.slice(7, 11),
    "customToday",
    "customYesterday",
  ]);
  assert.deepEqual(ids("last30"), [
    ...dates.slice(3, 11),
    "customToday",
    "customYesterday",
  ]);
  const seasonal: Game[] = ["2026-12-27", "2026-12-28", "2027-01-01"].map(
    (date) => ({
      id: date,
      kind: "daily",
      daily_date: date,
      name: null,
      created_at: "2027-01-01T12:00:00Z",
    }),
  );
  const seasonalResults = seasonal.map((game) => ({
    game_id: game.id,
    player_id: "a",
    points: 100,
  }));
  assert.equal(
    resultsForPeriod(
      seasonal,
      seasonalResults,
      "week",
      new Date("2027-01-01T12:00:00Z"),
    ).length,
    2,
  );
  assert.equal(
    resultsForPeriod(
      seasonal,
      seasonalResults,
      "year",
      new Date("2027-01-01T12:00:00Z"),
    ).length,
    1,
  );
});

test("delayed custom imports use played dates for standings periods", () => {
  const games: Game[] = [
    {
      id: "imported",
      kind: "custom",
      daily_date: null,
      name: "Timeguessr",
      played_on: "2026-10-08",
      created_at: "2026-10-09T12:00:00Z",
    },
  ];
  const results = [{ game_id: "imported", player_id: "a", points: 20000 }];
  const now = new Date("2026-10-09T12:00:00Z");
  assert.equal(resultsForPeriod(games, results, "today", now).length, 0);
  assert.equal(resultsForPeriod(games, results, "week", now).length, 1);
});
