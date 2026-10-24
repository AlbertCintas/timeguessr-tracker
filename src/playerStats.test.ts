import { test } from "node:test";
import assert from "node:assert/strict";
import { playerStats } from "./playerStats.ts";
const profiles = ["a", "b", "c"].map((id) => ({
  id,
  username: id,
  display_name: id,
  avatar_path: null,
}));

test("player stats combine game totals with picture details", () => {
  const [a, b, ...rest] = playerStats(profiles, [
    {
      game_id: "1",
      player_id: "a",
      points: 20000,
      rounds: [
        { points: 10000, years_off: 0, distance_km: 0.5 },
        { points: 0, years_off: 30, distance_km: null },
      ],
    },
    { game_id: "2", player_id: "a", points: 30000 },
    { game_id: "1", player_id: "b", points: 25000 },
  ]);
  assert.equal(rest.length, 0);
  assert.deepEqual(
    [a.id, a.games, a.wins, a.bestGame, a.worstGame, a.pictures],
    ["a", 2, 1, 30000, 20000, 2],
  );
  assert.deepEqual(
    [a.avgPicture, a.avgYears, a.avgDistance, a.closest],
    [5000, 15, 0.5, 0.5],
  );
  assert.deepEqual([a.exactYears, a.perfect, a.zeros], [1, 1, 1]);
  assert.deepEqual(
    [b.id, b.pictures, b.avgYears, b.closest],
    ["b", 0, null, null],
  );
});

test("the signed-in player comes first", () => {
  const results = [
    { game_id: "1", player_id: "a", points: 1 },
    { game_id: "2", player_id: "a", points: 1 },
    { game_id: "1", player_id: "b", points: 1 },
  ];
  assert.deepEqual(
    playerStats(profiles, results, "b").map((row) => row.id),
    ["b", "a"],
  );
  assert.deepEqual(
    playerStats(profiles, results, "c").map((row) => row.id),
    ["a", "b"],
  );
});
