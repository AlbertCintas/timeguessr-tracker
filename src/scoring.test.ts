import { test } from "node:test";
import assert from "node:assert/strict";
import {
  madridToday,
  ranked,
  standings,
  europeanDate,
  parseEuropeanDate,
} from "./scoring.ts";
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
