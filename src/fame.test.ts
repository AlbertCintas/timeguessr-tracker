import { test } from "node:test";
import assert from "node:assert/strict";
import { fameRankings, type FameMetric } from "./fame.ts";
import type { Game, PictureResult, Result } from "./types.ts";
const profiles = ["a", "b", "c"].map((id) => ({
  id,
  username: id,
  display_name: id,
  avatar_path: null,
}));
const daily = (day: number): Game => ({
  id: `d${day}`,
  kind: "daily",
  daily_date: `2026-10-${String(day).padStart(2, "0")}`,
  name: null,
  created_at: "2026-10-01T12:00:00Z",
});
const rounds = (
  years: number | null,
  km: number | null,
  points = 5000,
): PictureResult[] =>
  Array.from({ length: 5 }, () => ({
    points,
    years_off: years,
    distance_km: km,
  }));
const top = (metric: FameMetric, results: Result[], games: Game[] = []) =>
  fameRankings(profiles, results, games, metric).map((row) => [
    row.id,
    row.value,
    row.rank,
  ]);

test("averages need 20 non-null pictures", () => {
  const results: Result[] = [1, 2, 3, 4].flatMap((game) => [
    {
      game_id: `g${game}`,
      player_id: "a",
      points: 1,
      rounds: rounds(10, 100),
    },
    {
      game_id: `g${game}`,
      player_id: "b",
      points: 1,
      rounds: game === 4 ? rounds(null, null) : rounds(1, 1),
    },
  ]);
  results.push({
    game_id: "g5",
    player_id: "c",
    points: 1,
    rounds: rounds(0, 0),
  });
  assert.deepEqual(top("avgYears", results), [["a", 10, 1]]);
  assert.deepEqual(top("avgDistance", results), [["a", 100, 1]]);
});

test("closest guess and best game point at the game and picture", () => {
  const results: Result[] = [
    {
      game_id: "g1",
      player_id: "a",
      points: 30000,
      rounds: [
        { points: 1, years_off: 3, distance_km: 40 },
        { points: 1, years_off: 3, distance_km: 0.2 },
      ],
    },
    { game_id: "g2", player_id: "b", points: 42000, rounds: rounds(1, 5) },
  ];
  const closest = fameRankings(profiles, results, [], "closest")[0];
  assert.deepEqual(
    [closest.id, closest.value, closest.gameId, closest.picture],
    ["a", 0.2, "g1", 2],
  );
  const best = fameRankings(profiles, results, [], "bestGame")[0];
  assert.deepEqual([best.id, best.value, best.gameId], ["b", 42000, "g2"]);
});

test("exact years and perfect pictures are counted, ties share rank", () => {
  const results: Result[] = [
    {
      game_id: "g1",
      player_id: "a",
      points: 1,
      rounds: rounds(0, 1, 10000),
    },
    {
      game_id: "g1",
      player_id: "b",
      points: 1,
      rounds: rounds(0, 1, 10000),
    },
    { game_id: "g1", player_id: "c", points: 1, rounds: rounds(2, 1) },
  ];
  assert.deepEqual(top("exactYears", results), [
    ["a", 5, 1],
    ["b", 5, 1],
    ["c", 0, 3],
  ]);
  assert.deepEqual(top("perfect", results)[2], ["c", 0, 3]);
});

test("daily win streaks break on a loss or a missed day", () => {
  const games = [1, 2, 3, 4, 6, 7].map(daily);
  const result = (day: number, player: string, points: number): Result => ({
    game_id: `d${day}`,
    player_id: player,
    points,
  });
  const results = [
    result(1, "a", 10),
    result(2, "a", 10),
    result(2, "b", 10),
    result(3, "a", 10),
    result(3, "b", 20),
    result(4, "a", 10),
    result(6, "b", 10),
    result(7, "b", 10),
  ];
  assert.deepEqual(top("streak", results, games), [
    ["a", 2, 1],
    ["b", 2, 1],
  ]);
});
