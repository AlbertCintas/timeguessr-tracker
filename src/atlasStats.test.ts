import { test } from "node:test";
import assert from "node:assert/strict";
import {
  colorSteps,
  countryCounts,
  countryLastSeen,
  decadeAccuracy,
  decades,
  hexBins,
  pictureScores,
  stepLabel,
  stepOf,
} from "./atlasStats.ts";
import { continentOf, countryCode, flag } from "./countries.ts";
import type { FeaturedPicture } from "./featuredPictures.ts";

const picture = (
  gameId: string,
  round: number,
  year: number | null,
  country: string | null = null,
): FeaturedPicture => ({
  gameId,
  round,
  year,
  location: null,
  country,
  description: null,
});

test("color steps give single pictures their own step and stay geometric up to the maximum", () => {
  assert.deepEqual(colorSteps(1), [1]);
  assert.deepEqual(colorSteps(3), [1, 2, 3]);
  assert.deepEqual(colorSteps(6), [1, 2, 3, 6]);
  assert.deepEqual(colorSteps(20), [1, 3, 10, 20]);
  assert.deepEqual(colorSteps(100), [1, 5, 20, 100]);
  assert.deepEqual(colorSteps(137), [1, 5, 30, 137]);
  assert.deepEqual(colorSteps(1000), [1, 10, 100, 1000]);
  const steps = colorSteps(1000);
  assert.equal(stepOf(1, steps), 0);
  assert.equal(stepOf(11, steps), 2);
  assert.equal(stepOf(1000, steps), 3);
  assert.equal(stepLabel(steps, 0), "1");
  assert.equal(stepLabel(steps, 1), "2–10");
  assert.equal(stepLabel(colorSteps(3), 2), "3");
});

test("countries count each picture, most featured first, and empty decades stay in the strip", () => {
  const pictures = [
    picture("a", 0, 1904, "USA"),
    picture("a", 1, 1931, "France"),
    picture("b", 0, 1935, "USA"),
    picture("b", 1, null),
  ];
  assert.deepEqual(countryCounts(pictures), [
    { country: "USA", count: 2 },
    { country: "France", count: 1 },
  ]);
  assert.deepEqual(decades(pictures), [
    { decade: 1900, count: 1 },
    { decade: 1910, count: 0 },
    { decade: 1920, count: 0 },
    { decade: 1930, count: 2 },
  ]);
  assert.deepEqual(decades([]), []);
});

test("picture scores need two detailed players and never mention who played", () => {
  const pictures = [
    picture("g", 0, 1950, "Spain"),
    picture("g", 1, 1960, "Spain"),
    picture("h", 0, 1970, "Peru"),
  ];
  const round = (points: number, years_off: number, distance_km: number) => ({
    points,
    years_off,
    distance_km,
  });
  const scores = pictureScores(pictures, [
    {
      game_id: "g",
      player_id: "a",
      points: 0,
      rounds: [round(2000, 30, 900), round(9000, 1, 10)],
    },
    {
      game_id: "g",
      player_id: "b",
      points: 0,
      rounds: [round(4000, 10, 1100), round(8000, 3, 30)],
    },
    { game_id: "h", player_id: "a", points: 0, rounds: [round(5000, 5, 5)] },
    { game_id: "h", player_id: "b", points: 0 },
  ]);
  assert.deepEqual(
    scores.map((s) => [
      s.picture.round,
      s.players,
      s.points,
      s.spread,
      s.yearsOff,
      s.kmOff,
    ]),
    [
      [0, 2, 3000, 2000, 20, 1000],
      [1, 2, 8500, 1000, 2, 20],
    ],
  );
  assert.deepEqual(
    pictureScores(
      [picture("g", 0, 1950)],
      [0, 0, 3].map((years_off, i) => ({
        game_id: "g",
        player_id: String(i),
        points: 0,
        rounds: [round(5000, years_off, 1)],
      })),
    ).map((s) => s.exactYears),
    [2],
  );
  assert.ok(scores.every((s) => !("player_id" in s)));
});

test("Timeguessr country names resolve to region codes and flags", () => {
  assert.equal(countryCode("USA"), "US");
  assert.equal(countryCode("UK"), "GB");
  assert.equal(countryCode("Turkey"), "TR");
  assert.equal(countryCode("czechia"), "CZ");
  assert.equal(countryCode("South Korea"), "KR");
  assert.equal(countryCode("Palestinian territories or Israel"), null);
  assert.equal(flag("France"), "🇫🇷");
  assert.equal(countryCode("Germany"), "DE");
  assert.equal(countryCode("Vietnam"), "VN");
  assert.equal(flag("Atlantis"), "");
});

test("decade accuracy averages every detailed guess and last seen keeps the latest date", () => {
  const pictures = [
    picture("old", 0, 1912, "France"),
    picture("new", 0, 1918, "France"),
    picture("new", 1, 1990, "Peru"),
  ];
  const results = [
    {
      game_id: "old",
      player_id: "a",
      points: 0,
      rounds: [{ points: 0, years_off: 10, distance_km: 0 }],
    },
    {
      game_id: "new",
      player_id: "a",
      points: 0,
      rounds: [
        { points: 0, years_off: 20, distance_km: 0 },
        { points: 0, years_off: null, distance_km: 0 },
      ],
    },
  ];
  assert.deepEqual([...decadeAccuracy(pictures, results)], [[1910, 15]]);
  const dates: Record<string, string> = {
    old: "2026-10-01",
    new: "2026-10-20",
  };
  assert.deepEqual(
    [...countryLastSeen(pictures, (id) => dates[id] ?? null)],
    [
      ["France", "2026-10-20"],
      ["Peru", "2026-10-20"],
    ],
  );
});

test("continents cover Timeguessr's own names", () => {
  assert.equal(continentOf("USA"), "North America");
  assert.equal(continentOf("Russia"), "Europe");
  assert.equal(continentOf("Palestinian territories or Israel"), "Asia");
  assert.equal(continentOf("Uruguay"), "South America");
  assert.equal(continentOf("Atlantis"), null);
});

test("hexBins puts each point in the hexagon whose centre is nearest", () => {
  const r = 10;
  const points = [
    { x: 0, y: 0 },
    { x: 3, y: 2 },
    { x: 17.3, y: 0 },
    { x: 8.7, y: 15 },
    { x: 100, y: 100 },
  ];
  const bins = hexBins(points, (p) => p, r);
  assert.deepEqual(
    bins.map((b) => b.items.length),
    [2, 1, 1, 1],
  );
  for (const bin of bins)
    for (const p of bin.items)
      assert.ok(Math.hypot(p.x - bin.x, p.y - bin.y) <= r);
});
