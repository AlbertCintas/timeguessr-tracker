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

test("averages need 5 detailed games", () => {
  const results: Result[] = [1, 2, 3, 4, 5].flatMap((game) => [
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
      rounds: game === 5 ? rounds(null, null) : rounds(1, 1),
    },
  ]);
  results.push({
    game_id: "g6",
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

const playerGames = (
  player: string,
  games: number,
  hits: number,
  hit: PictureResult,
  miss: PictureResult,
): Result[] =>
  Array.from({ length: games }, (_, game) => ({
    game_id: `g${game}`,
    player_id: player,
    points: 1,
    rounds: Array.from({ length: 5 }, (_, picture) =>
      game * 5 + picture < hits ? hit : miss,
    ),
  }));

test("rates beat volume and need 5 detailed games", () => {
  const exact = { points: 10000, years_off: 0, distance_km: 1 };
  const off = { points: 5000, years_off: 2, distance_km: 1 };
  const results = [
    ...playerGames("a", 10, 6, exact, off),
    ...playerGames("b", 5, 5, exact, off),
    ...playerGames("c", 1, 5, exact, off),
  ];
  assert.deepEqual(top("exactYears", results), [
    ["b", 0.2, 1],
    ["a", 0.12, 2],
  ]);
  assert.deepEqual(top("perfect", results), [
    ["b", 0.2, 1],
    ["a", 0.12, 2],
  ]);
  const winner = fameRankings(profiles, results, [], "exactYears")[0];
  assert.deepEqual([winner.count, winner.samples], [5, 25]);
});

test("equal rates share a rank", () => {
  const exact = { points: 1, years_off: 0, distance_km: 1 };
  const off = { points: 1, years_off: 2, distance_km: 1 };
  const results = [
    ...playerGames("a", 5, 1, exact, off),
    ...playerGames("b", 10, 2, exact, off),
  ];
  assert.deepEqual(top("exactYears", results), [
    ["a", 0.04, 1],
    ["b", 0.04, 1],
  ]);
});

test("perfect locations count guesses within 50 m", () => {
  const results = [0.0136, 0.05, 0.0749, null, 12.5].map(
    (distance_km, game): Result => ({
      game_id: `g${game}`,
      player_id: "a",
      points: 1,
      rounds: [{ points: 1, years_off: 3, distance_km }],
    }),
  );
  results.push({
    game_id: "g5",
    player_id: "a",
    points: 1,
    rounds: [{ points: 1, years_off: 3, distance_km: 40 }],
  });
  assert.deepEqual(top("perfectLocations", results), [["a", 0.4, 1]]);
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
