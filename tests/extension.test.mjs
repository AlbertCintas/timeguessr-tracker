import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureModern,
  captureLegacy,
  validateCapture,
  dailyDate,
  externalKey,
} from "../extension/capture.js";

const href = "https://timeguessr.com/final-score?mode=daily";
const snapshot = () => ({
  mode: "daily",
  score: 20000,
  dailyNumber: "1227",
  playArray: Array.from({ length: 5 }, (_, i) => ({
    No: "1227",
    ImageId: `picture${i}`,
  })),
  roundResults: Array.from({ length: 5 }, () => ({
    totalScore: 4000,
    guessYear: 2000,
    actualYear: 1990,
    distanceMeters: 1300,
  })),
});

test("modern finished games preserve genuine zero scores and unknown errors", async () => {
  const data = snapshot();
  const parsed = captureModern(data, href, "2026-10-09");
  assert.equal(parsed.points, 20000);
  assert.deepEqual(parsed.rounds[0], {
    points: 4000,
    years_off: 10,
    distance_km: 1.3,
  });
  data.roundResults[0] = {
    totalScore: 0,
    noGuess: true,
    guessYear: 0,
    actualYear: 1990,
    distanceMeters: 0,
  };
  data.score = 16000;
  assert.deepEqual(captureModern(data, href).rounds[0], {
    points: 0,
    years_off: null,
    distance_km: null,
  });
  delete data.roundResults[0].totalScore;
  assert.throws(() => captureModern(data, href));
  assert.equal(captureModern(snapshot(), "https://timeguessr.com/play"), null);
  assert.equal(captureModern(snapshot(), href + "&game_id=someone-else"), null);
  assert.equal(captureModern(snapshot(), href + "&archive=1226"), null);
  const incomplete = snapshot();
  incomplete.roundResults.pop();
  assert.equal(captureModern(incomplete, href), null);
  const mismatch = snapshot();
  mismatch.score++;
  assert.throws(() => captureModern(mismatch, href));
});

test("legacy capture requires visible total and complete stored scores", () => {
  const values = {
    dailyNumber: "1227",
    dailyArray: JSON.stringify(snapshot().playArray),
  };
  for (const p of ["one", "two", "three", "four", "five"])
    Object.assign(values, {
      [p + "Total"]: "4000",
      [p + "Year"]: "0",
      [p + "Distance"]: "1,300 m",
    });
  const url = "https://timeguessr.com/finalscoredaily";
  const parsed = captureLegacy(values, url, "20,000", "2026-10-09");
  assert.deepEqual(parsed.rounds[0], {
    points: 4000,
    years_off: 0,
    distance_km: 1.3,
  });
  delete values.oneYear;
  delete values.oneDistance;
  assert.deepEqual(captureLegacy(values, url, "20000").rounds[0], {
    points: 4000,
    years_off: null,
    distance_km: null,
  });
  assert.equal(captureLegacy(values, url, "21000"), null);
  delete values.oneTotal;
  assert.equal(captureLegacy(values, url, "16000"), null);
});

test("non-daily identities match shared pictures, distinguish ordering and timers", async () => {
  const data = snapshot();
  data.mode = "play";
  data.dailyNumber = null;
  data.gameId = null;
  const capture = captureModern(
    data,
    "https://timeguessr.com/final-score?mode=play",
  );
  const key = await externalKey(capture);
  assert.match(key, /^timeguessr:v1:[a-f0-9]{64}$/);
  assert.equal(
    key,
    await externalKey({ ...capture, played_on: "2026-10-08", points: 1 }),
  );
  assert.notEqual(key, await externalKey({ ...capture, timer_seconds: 60 }));
  assert.notEqual(
    key,
    await externalKey({ ...capture, images: [...capture.images].reverse() }),
  );
  assert.equal(await externalKey(captureModern(snapshot(), href)), null);
  assert.throws(() =>
    validateCapture({ ...capture, images: [], source_id: null }),
  );
  assert.throws(() =>
    validateCapture({
      ...capture,
      rounds: capture.rounds.map((r) => ({ ...r, distance_km: -1 })),
    }),
  );
});

test("daily dates use official metadata across reset, archives and time zones", () => {
  const ends = Date.parse("2026-10-10T06:59:59Z");
  const html = `dailyNumber:1227,countdownEndsAt:${ends}`;
  assert.equal(
    dailyDate(1227, html, Date.parse("2026-10-09T23:30:00Z")),
    "2026-10-09",
  );
  assert.equal(
    dailyDate(1226, html, Date.parse("2026-10-09T23:30:00Z")),
    "2026-10-08",
  );
  assert.throws(() => dailyDate(1228, html, ends - 1000));
  assert.throws(() => dailyDate(1227, html, ends + 1));
  assert.throws(() =>
    dailyDate(1227, html.replace("1227", "1226"), ends - 1000),
  );
  assert.throws(() => dailyDate(1227, "", ends - 1000));
});

test("non-daily capture saves replay IDs from random games and shared challenges without changing existing fingerprints", async () => {
  const id = `${"a".repeat(64)}:${"b".repeat(32)}`;
  const data = { ...snapshot(), mode: "play", dailyNumber: null, gameId: null };
  const url = "https://timeguessr.com/final-score?mode=play";
  const before = captureModern(data, url);
  data.playArray.push("a".repeat(64), "b".repeat(32));
  const captured = captureModern(data, url);
  assert.equal(captured.replay_id, id);
  assert.equal(await externalKey(captured), await externalKey(before));
  assert.equal(
    captureModern({ ...data, gameId: id, timerSeconds: 60 }, url).replay_id,
    id,
  );
  assert.equal(
    captureModern(
      { ...data, playArray: [...data.playArray.slice(0, 5), "bad", "id"] },
      url,
    ).replay_id,
    null,
  );
  assert.throws(() =>
    validateCapture({ ...captured, replay_id: "https://example.com" }),
  );
  assert.equal(captureModern(snapshot(), href).replay_id, null);
  const values = {
    playArray: JSON.stringify(data.playArray),
    timerSetting: "60",
  };
  for (const prefix of ["one", "two", "three", "four", "five"]) {
    values[prefix + "Total"] = "4000";
  }
  assert.equal(
    captureLegacy(values, "https://timeguessr.com/finalscore", "20000")
      .replay_id,
    id,
  );
});
