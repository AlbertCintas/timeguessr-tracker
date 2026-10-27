import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchGameAnswers } from "../extension/backfill.js";
const fixture = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`./fixtures/timeguessr/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const replayId =
  "486e1bb323cdb6b03defc37a822b41b2b109f5beecca4bee14be81b86a4c1d2e:1aafa2c966819cb349e57d3db9b435a7";
const daily = { kind: "daily", daily_date: "2026-10-09" };

test("daily backfill follows the site's dated archive link and reads original years/coordinates, without guesses", async () => {
  const calls = [];
  const result = await fetchGameAnswers(daily, async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, "omit");
    assert.equal(options.method, undefined);
    return Response.json(
      await fixture(
        url.includes("/archive/") ? "archive-october" : "daily-1227",
      ),
    );
  });
  assert.equal(result.status, "ready");
  assert.equal(
    calls[0],
    "https://timeguessr.com/archive/__data.json?month=2026-10",
  );
  assert.equal(
    calls[1],
    "https://timeguessr.com/play/__data.json?mode=daily&archive=1227-c4325922368acb2a08bd",
  );
  assert.equal(
    result.source,
    "https://timeguessr.com/play?mode=daily&archive=1227-c4325922368acb2a08bd",
  );
  assert.equal(result.answers.length, 5);
  assert.deepEqual(result.answers[0], {
    actual_year: 1986,
    actual_location: { lat: 40.76634382741177, lng: -73.97978740552426 },
  });
});

test("replay backfill verifies the complete replay identity and retains original round order", async () => {
  const result = await fetchGameAnswers(
    { kind: "custom", replay_id: replayId },
    async (url) => {
      assert.equal(
        url,
        `https://timeguessr.com/game-settings/__data.json?RA=${encodeURIComponent(replayId)}`,
      );
      return Response.json(await fixture("replay"));
    },
  );
  assert.equal(result.status, "ready");
  assert.equal(result.answers[0].actual_year, 1918);
  assert.equal(result.answers[1].actual_year, 1989);
  const mismatched = await fetchGameAnswers(
    { kind: "custom", replay_id: `${"a".repeat(64)}:${"b".repeat(32)}` },
    async () => Response.json(await fixture("replay")),
  );
  assert.equal(mismatched.status, "unavailable");
});

test("missing identity and unavailable archives do not fabricate answers or follow arbitrary URLs", async () => {
  const never = () => {
    throw new Error("Unexpected request");
  };
  assert.equal(
    (await fetchGameAnswers({ kind: "custom", name: "Our game" }, never))
      .status,
    "unavailable",
  );
  const archive = await fixture("archive-october");
  const data = archive.nodes[0].data;
  const index = data.findIndex(
    (v) => v === "/play?mode=daily&archive=1227-c4325922368acb2a08bd",
  );
  data[index] = "https://evil.example/answers";
  assert.equal(
    (await fetchGameAnswers(daily, async () => Response.json(archive))).status,
    "unavailable",
  );
  assert.equal(
    (
      await fetchGameAnswers(
        { kind: "daily", daily_date: "2020-01-01" },
        async () => Response.json(archive),
      )
    ).status,
    "unavailable",
  );
});

test("mismatched daily pictures are rejected; unsupported/invalid metadata never becomes a guess or a zero coordinate", async () => {
  const page = await fixture("daily-1227");
  const data = page.nodes[0].data;
  data[data.findIndex((v) => v === "1227")] = "1226";
  const request = async (url) =>
    Response.json(
      url.includes("/archive/") ? await fixture("archive-october") : page,
    );
  assert.equal((await fetchGameAnswers(daily, request)).status, "unavailable");
  const replay = await fixture("replay");
  const values = replay.nodes[0].data;
  const first = values[values[0].playArray][0];
  values[values[first].Year] = "n/a";
  const location = values[values[first].Location];
  values[location.lat] = null;
  const result = await fetchGameAnswers(
    { kind: "custom", replay_id: replayId },
    async () => Response.json(replay),
  );
  assert.deepEqual(result.answers[0], {
    actual_year: null,
    actual_location: null,
  });
});

test("site downtime and throttling are retried; missing sources are marked unavailable", async () => {
  for (const status of [429, 500, 503])
    assert.equal(
      (await fetchGameAnswers(daily, async () => new Response("", { status })))
        .status,
      "retry",
    );
  for (const status of [403, 404])
    assert.equal(
      (await fetchGameAnswers(daily, async () => new Response("", { status })))
        .status,
      "unavailable",
    );
  assert.equal(
    (
      await fetchGameAnswers(daily, async () => {
        throw new Error("Offline");
      })
    ).status,
    "retry",
  );
  assert.equal(
    (
      await fetchGameAnswers(
        daily,
        async () => new Response("<html>Login</html>"),
      )
    ).status,
    "retry",
  );
});

test("today's already-played daily is read from the current route only when the archive identifies it as today", async () => {
  const result = await fetchGameAnswers(
    { kind: "daily", daily_date: "2026-10-27" },
    async (url) => {
      if (!url.includes("/archive/"))
        assert.equal(url, "https://timeguessr.com/play/__data.json?mode=daily");
      return Response.json(
        await fixture(
          url.includes("/archive/") ? "archive-october" : "daily-current",
        ),
      );
    },
  );
  assert.equal(result.status, "ready");
  assert.equal(result.answers.length, 5);
  assert.equal(result.source, "https://timeguessr.com/archive?month=2026-10");
  const wrongDaily = await fetchGameAnswers(
    { kind: "daily", daily_date: "2026-10-27" },
    async (url) =>
      Response.json(
        await fixture(
          url.includes("/archive/") ? "archive-october" : "daily-1227",
        ),
      ),
  );
  assert.equal(wrongDaily.status, "unavailable");
});
