import { test } from "node:test";
import assert from "node:assert/strict";
import {
  featuredPictures,
  yearDistribution,
  locationDensity,
} from "./featuredPictures.ts";
import type { PictureResult, Result } from "./types.ts";
const round = (answer: Partial<PictureResult> = {}): PictureResult => ({
  points: 10000,
  years_off: 0,
  distance_km: 0,
  ...answer,
});
const result = (
  player: string,
  rounds: PictureResult[],
  game = "daily",
): Result => ({ game_id: game, player_id: player, points: 50000, rounds });

test("answers merge by game and round, preserving repeats in different games without multiplying players", () => {
  const answers = [
    round({ actual_year: 1990 }),
    round({ actual_location: { lat: 0, lng: 0 } }),
  ];
  const pictures = featuredPictures([
    result("alice", answers),
    result("bob", answers),
    result("bob", answers, "other"),
  ]);
  assert.equal(pictures.length, 4);
  assert.deepEqual(yearDistribution(pictures), [{ year: 1990, count: 2 }]);
  assert.deepEqual(locationDensity(pictures), [{ lat: 0, lng: 0, count: 2 }]);
});

test("partial answers enrich each other; conflicts exclude only the disputed field", () => {
  const pictures = featuredPictures([
    result("alice", [
      round({ actual_year: 1990 }),
      round({ actual_year: 2000, actual_location: { lat: 5, lng: 5 } }),
    ]),
    result("bob", [
      round({ actual_location: { lat: 0, lng: 0 } }),
      round({ actual_year: 2001, actual_location: { lat: 5, lng: 5 } }),
    ]),
  ]);
  assert.deepEqual(pictures, [
    { year: 1990, location: { lat: 0, lng: 0 } },
    { year: null, location: { lat: 5, lng: 5 } },
  ]);
  assert.deepEqual(
    featuredPictures([{ game_id: "old", player_id: "alice", points: 0 }]),
    [],
  );
});

test("heatmap includes zero coordinates and bounds, normalizes dateline, and bins negative coordinates", () => {
  const pictures = [
    { year: null, location: { lat: 90, lng: 180 } },
    { year: null, location: { lat: -90, lng: -180 } },
    { year: null, location: { lat: -0.1, lng: -0.1 } },
  ];
  assert.deepEqual(
    locationDensity(pictures).map(({ lat, lng }) => [lat, lng]),
    [
      [-90, -180],
      [-5, -5],
      [85, -180],
    ],
  );
});
