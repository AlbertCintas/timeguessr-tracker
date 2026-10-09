import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimeguessrResults } from "./importResults.ts";
import { shameRankings } from "./shame.ts";
const detailed = `TimeGuessr #1227 — 37,894/50,000

1️⃣ 🏆8,359 · 📅 7y · 🌍 1.3km
2️⃣ 🏆9,855 · 📅 0y · 🌍 11.3km
3️⃣ 🏆6,925 · 📅 11y · 🌍 3.5km
4️⃣ 🏆7,463 · 📅 10y · 🌍 1.1km
5️⃣ 🏆5,292 · 📅 17y · 🌍 208.2km

https://timeguessr.com`;
test("imports the actual Detailed share format and older dash separators", () => {
  const imported = parseTimeguessrResults(detailed);
  assert.equal(imported.points, 37894);
  assert.equal(imported.dailyNumber, 1227);
  assert.deepEqual(imported.rounds?.[4], {
    points: 5292,
    years_off: 17,
    distance_km: 208.2,
  });
  assert.deepEqual(
    parseTimeguessrResults(detailed.replaceAll(" · ", " - ")),
    imported,
  );
  assert.equal(
    parseTimeguessrResults(detailed.replace("1.3km", "1300m")).rounds?.[0]
      .distance_km,
    1.3,
  );
  assert.equal(
    parseTimeguessrResults(detailed.replace("1.3km", "1mi")).rounds?.[0]
      .distance_km,
    1.609344,
  );
  assert.equal(
    parseTimeguessrResults(detailed.replace("208.2km", "20,000km")).rounds?.[4]
      .distance_km,
    20000,
  );
  assert.equal(
    parseTimeguessrResults(detailed.replace("7y", "-7y")).rounds?.[0].years_off,
    7,
  );
});
test("emoji-grid and total-only shares never invent picture statistics", () => {
  const parsed = parseTimeguessrResults(
    "TimeGuessr #1227 37,894/50,000\n🌎🟩🟩⬛ 📅🟩⬛⬛\nhttps://timeguessr.com",
  );
  assert.equal(parsed.points, 37894);
  assert.equal(parsed.rounds, null);
  const missing = parseTimeguessrResults(
    detailed.replace("7y", "-").replace("1.3km", "-"),
  );
  assert.equal(missing.rounds?.[0].years_off, null);
  assert.equal(missing.rounds?.[0].distance_km, null);
  assert.deepEqual(parseTimeguessrResults("TimeGuessr — 0/50,000"), {
    points: 0,
    dailyNumber: null,
    rounds: null,
  });
});
test("rejects incomplete, duplicated, malformed and inconsistent details", () => {
  for (const text of [
    "hello",
    "TimeGuessr #1 — 50,001/50,000",
    detailed.replace("37,894", "37,895"),
    detailed.replace("1.3km", "1.3furlongs"),
    detailed.replace("2️⃣", "1️⃣"),
    detailed
      .split("\n")
      .filter((line) => !line.startsWith("5️⃣"))
      .join("\n"),
    detailed.replace("8,359", "10,001"),
    "x".repeat(10001),
  ])
    assert.throws(() => parseTimeguessrResults(text));
});
const profiles = ["a", "b", "c"].map((id) => ({
  id,
  username: id,
  display_name: id,
  avatar_path: null,
}));
test("shame rankings include manual totals and exclude missing details from picture metrics", () => {
  const imported = parseTimeguessrResults(detailed);
  const results = [
    { game_id: "1", player_id: "a", points: 100 },
    {
      game_id: "2",
      player_id: "b",
      points: imported.points,
      rounds: imported.rounds,
    },
    {
      game_id: "3",
      player_id: "b",
      points: 0,
      rounds: Array.from({ length: 5 }, () => ({
        points: 0,
        years_off: null,
        distance_km: null,
      })),
    },
  ];
  const worst = shameRankings(profiles, results, "worstGame");
  assert.deepEqual(
    worst.map((row) => [row.id, row.value]),
    [
      ["b", 0],
      ["a", 100],
    ],
  );
  assert.equal(shameRankings(profiles, results, "zeros")[0].value, 5);
  assert.deepEqual(
    shameRankings(profiles, results, "years").map((row) => [
      row.id,
      row.value,
      row.picture,
      row.gameId,
    ]),
    [["b", 17, 5, "2"]],
  );
  assert.equal(shameRankings(profiles, results, "distance")[0].value, 208.2);
  assert.equal(shameRankings(profiles, results, "worstPicture")[0].value, 0);
  const tied = shameRankings(
    profiles,
    [...results, { game_id: "4", player_id: "a", points: 0 }],
    "worstGame",
  );
  assert.deepEqual(
    tied.map((row) => row.rank),
    [1, 1],
  );
  assert.equal(shameRankings(profiles, [], "zeros").length, 0);
});
