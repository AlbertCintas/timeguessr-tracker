import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fetchGameAnswers } from "../extension/backfill.js";
import { IDBFactory } from "fake-indexeddb";
import {
  validateCapture,
  dailyDate,
  externalKey,
} from "../extension/capture.js";

const source = (
  await readFile(new URL("../extension/background.js", import.meta.url), "utf8")
).replace(/^import .*;\n/gm, "");
async function setup(initial = {}, firefox = false) {
  const stored = structuredClone(initial),
    calls = [],
    backfillCalls = [],
    events = {};
  let session = null,
    offline = false,
    conflict = false,
    expired = false,
    accesses = [],
    backfillGames = [],
    backfillFetch = fetch;
  const chrome = {
    storage: {
      local: {
        async setAccessLevel(value) {
          accesses.push(value.accessLevel);
        },
        async get(keys) {
          return Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((k) => k in stored)
              .map((k) => [k, structuredClone(stored[k])]),
          );
        },
        async set(data) {
          Object.assign(stored, structuredClone(data));
        },
        async remove(key) {
          delete stored[key];
        },
      },
    },
    runtime: {
      id: "extension-id",
      getURL: (p) => "chrome-extension://extension-id/" + p,
      onMessage: {
        addListener(fn) {
          events.message = fn;
        },
      },
      onStartup: {
        addListener(fn) {
          events.startup = fn;
        },
      },
    },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
    alarms: {
      async create() {},
      onAlarm: {
        addListener(fn) {
          events.alarm = fn;
        },
      },
    },
  };
  if (firefox) delete chrome.storage.local.setAccessLevel;
  const db = {
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
      async refreshSession() {
        return expired
          ? { data: { session: null }, error: new Error("Expired") }
          : {
              data: {
                session: { ...session, expires_at: Date.now() / 1000 + 3600 },
              },
              error: null,
            };
      },
      async signInWithPassword({ email }) {
        const id = email.split("@")[0];
        session = { user: { id }, expires_at: Date.now() / 1000 + 3600 };
        return { data: { user: { id } }, error: null };
      },
      async signOut() {
        session = null;
        return { error: null };
      },
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return {
            data: { username: session.user.id, display_name: session.user.id },
            error: null,
          };
        },
      };
    },
    async rpc(name, args) {
      if (name === "timeguessr_backfill_candidates")
        return { data: backfillGames.slice(0, 3), error: null };
      if (name === "backfill_timeguessr_answers") {
        backfillCalls.push({ name, args, uid: session.user.id });
        backfillGames = backfillGames.filter((g) => g.id !== args.target_game);
        return {
          data: { status: args.answers ? "enriched" : "unavailable" },
          error: null,
        };
      }
      calls.push({ name, args, uid: session.user.id });
      if (offline) return { error: { message: "Offline" } };
      return {
        data: { status: conflict ? "conflict" : "saved", game_id: "game" },
        error: null,
      };
    },
  };
  const context = vm.createContext({
    chrome,
    indexedDB: new IDBFactory(),
    createClient: () => db,
    validateCapture,
    dailyDate,
    externalKey,
    fetchGameAnswers: (game) =>
      fetchGameAnswers(game, (...args) => backfillFetch(...args)),
    console,
    AbortSignal,
    fetch,
    Date,
    URL,
    Error,
    JSON,
    Boolean,
    String,
    Number,
    Object,
    Array,
    Promise,
  });
  vm.runInContext(source, context);
  await vm.runInContext("ready", context);
  const popup = {
    id: "extension-id",
    url: chrome.runtime.getURL("popup.html"),
  };
  const page = {
    id: "extension-id",
    url: "https://timeguessr.com/final-score?mode=play",
    tab: { id: 1 },
  };
  const send = (type, fields = {}, sender = popup) =>
    new Promise((resolve) =>
      events.message({ type, ...fields }, sender, resolve),
    );
  const idle = async () => {
    for (let i = 0; i < 4; i++) {
      await vm.runInContext("chain", context);
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  return {
    context,
    stored,
    calls,
    backfillCalls,
    setBackfill(games, request) {
      backfillGames = games;
      backfillFetch = request;
    },
    events,
    send,
    idle,
    page,
    accesses,
    setOffline(v) {
      offline = v;
    },
    setConflict(v) {
      conflict = v;
    },
    expire() {
      expired = true;
      session.expires_at = 0;
    },
  };
}
const capture = {
  mode: "play",
  points: 20000,
  rounds: Array.from({ length: 5 }, () => ({
    points: 4000,
    years_off: null,
    distance_km: null,
  })),
  played_on: "2026-10-09",
  source_id: null,
  images: ["1", "2", "3", "4", "5"],
  timer_seconds: 0,
};

test("worker persists offline queue, retries after restart, and prevents duplicate uploads", async () => {
  const app = await setup();
  assert.deepEqual(app.accesses, ["TRUSTED_CONTEXTS"]);
  await app.send("login", { username: "alice", password: "private-password" });
  app.setOffline(true);
  assert.equal(
    (await app.send("capture", { capture }, app.page)).accepted,
    true,
  );
  await app.idle();
  assert.equal(app.stored.queue.length, 1);
  assert.equal(app.stored.queue[0].uid, "alice");
  assert(!JSON.stringify(app.stored).includes("private-password"));
  app.stored.queue[0].capture.rounds = app.stored.queue[0].capture.rounds.map(
    (r) => ({
      distance_km: r.distance_km,
      years_off: r.years_off,
      points: r.points,
    }),
  );
  const restarted = await setup(app.stored);
  await restarted.send("login", {
    username: "alice",
    password: "private-password",
  });
  await restarted.idle();
  assert.equal(restarted.stored.queue.length, 0);
  assert.equal(restarted.stored.history[0].status, "saved");
  const count = restarted.calls.length;
  await restarted.send("capture", { capture }, restarted.page);
  await restarted.idle();
  assert.equal(restarted.calls.length, count);
});

test("worker never replays another account’s queue, preserves conflicts and pauses", async () => {
  const app = await setup();
  await app.send("login", { username: "alice", password: "password" });
  app.setOffline(true);
  await app.send("capture", { capture }, app.page);
  await app.idle();
  await app.send("logout");
  await app.send("login", { username: "bob", password: "password" });
  app.setOffline(false);
  await app.idle();
  assert.equal(app.calls.filter((c) => c.uid === "bob").length, 0);
  assert.equal((await app.send("state")).queue.length, 0);
  await app.send("toggle", { enabled: false });
  assert.equal(
    (await app.send("capture", { capture }, app.page)).accepted,
    false,
  );
  await app.send("toggle", { enabled: true });
  app.setConflict(true);
  await app.send("capture", { capture }, app.page);
  await app.idle();
  assert.equal(
    app.stored.queue.find((item) => item.uid === "bob").status,
    "conflict",
  );
  const conflict = (await app.send("state")).queue[0];
  await app.send("retry");
  await app.idle();
  assert.equal(
    app.stored.queue.find((item) => item.uid === "bob").status,
    "conflict",
  );
  await app.send("discard", { id: conflict.id });
  assert.equal(app.stored.queue.length, 1);
  await app.send("logout");
  app.setConflict(false);
  await app.send("login", { username: "alice", password: "password" });
  await app.idle();
  assert.equal(app.stored.queue.length, 0);
});

test("worker rejects hostile senders and pauses uploads for expired authentication", async () => {
  const app = await setup();
  const hostile = {
    id: "extension-id",
    url: "https://timeguessr.com/final-score",
    tab: { id: 1 },
  };
  assert.match(
    (
      await app.send(
        "login",
        { username: "alice", password: "secret" },
        hostile,
      )
    ).error,
    /Open the extension/,
  );
  await app.send("login", { username: "alice", password: "password" });
  assert.match(
    (
      await app.send(
        "capture",
        { capture },
        { ...hostile, url: "https://evil.example/" },
      )
    ).error,
    /Unknown result source/,
  );
  app.expire();
  await app.send("capture", { capture }, app.page);
  await app.idle();
  assert.equal(app.calls.length, 0);
  assert.equal(app.stored.queue.length, 1);
  assert.match(app.stored.message, /Sign in again/);
});

test("Firefox stores auth in extension IndexedDB without exposing it through storage.local", async () => {
  const app = await setup({}, true);
  await vm.runInContext(
    'authStorage.setItem("club-auth", "private-refresh-token")',
    app.context,
  );
  assert.equal(
    await vm.runInContext('authStorage.getItem("club-auth")', app.context),
    "private-refresh-token",
  );
  assert.equal(app.stored["club-auth"], undefined);
  await vm.runInContext('authStorage.removeItem("club-auth")', app.context);
  assert.equal(
    await vm.runInContext('authStorage.getItem("club-auth")', app.context),
    null,
  );
});

test("worker enriches pending and saved captures with replay IDs", async () => {
  const app = await setup();
  const replay_id = `${"a".repeat(64)}:${"b".repeat(32)}`;
  await app.send("login", { username: "alice", password: "password" });
  app.setOffline(true);
  await app.send("capture", { capture }, app.page);
  await app.idle();
  await app.send("capture", { capture: { ...capture, replay_id } }, app.page);
  await app.idle();
  assert.equal(app.stored.queue[0].capture.replay_id, replay_id);
  app.setOffline(false);
  await app.send("retry");
  await app.idle();
  assert.equal(app.calls.at(-1).args.replay_game_id, replay_id);
  const saved = await setup();
  await saved.send("login", { username: "alice", password: "password" });
  await saved.send("capture", { capture }, saved.page);
  await saved.idle();
  const count = saved.calls.length;
  await saved.send(
    "capture",
    { capture: { ...capture, replay_id } },
    saved.page,
  );
  await saved.idle();
  assert.equal(saved.calls.length, count + 1);
  assert.equal(saved.calls.at(-1).args.replay_game_id, replay_id);
});

test("worker enriches both queued and previously uploaded captures with actual answers", async () => {
  const enriched = {
    ...capture,
    rounds: capture.rounds.map((r) => ({
      ...r,
      actual_year: 1990,
      actual_location: { lat: 0, lng: 0 },
    })),
  };
  const app = await setup();
  await app.send("login", { username: "alice", password: "password" });
  app.setOffline(true);
  await app.send("capture", { capture }, app.page);
  await app.idle();
  await app.send("capture", { capture: enriched }, app.page);
  await app.idle();
  assert.equal(app.stored.queue[0].capture.rounds[0].actual_year, 1990);
  app.setOffline(false);
  await app.send("retry");
  await app.idle();
  assert.deepEqual(app.calls.at(-1).args.pictures[0].actual_location, {
    lat: 0,
    lng: 0,
  });
  const saved = await setup();
  await saved.send("login", { username: "alice", password: "password" });
  await saved.send("capture", { capture }, saved.page);
  await saved.idle();
  const count = saved.calls.length;
  await saved.send("capture", { capture: enriched }, saved.page);
  await saved.idle();
  assert.equal(saved.calls.length, count + 1);
  assert.equal(saved.calls.at(-1).args.pictures[0].actual_year, 1990);
  await saved.send("capture", { capture: enriched }, saved.page);
  await saved.idle();
  assert.equal(saved.calls.length, count + 1);
});

test("automatic backfill enriches saved games in bounded batches, persists cooldown and respects pause/sign-out", async () => {
  const app = await setup();
  const replay =
    "486e1bb323cdb6b03defc37a822b41b2b109f5beecca4bee14be81b86a4c1d2e:1aafa2c966819cb349e57d3db9b435a7";
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/timeguessr/replay.json", import.meta.url),
      "utf8",
    ),
  );
  app.setBackfill(
    Array.from({ length: 5 }, (_, i) => ({
      id: `game${i}`,
      kind: "custom",
      replay_id: replay,
    })),
    async () => Response.json(fixture),
  );
  await app.send("login", { username: "alice", password: "password" });
  await app.idle();
  assert.equal(app.backfillCalls.length, 3);
  assert.equal(app.backfillCalls[0].args.answers[0].actual_year, 1918);
  assert.equal(app.backfillCalls[0].uid, "alice");
  assert.match(app.stored.backfill.message, /3 games backfilled/);
  app.events.alarm({ name: "retry-imports" });
  await app.idle();
  assert.equal(app.backfillCalls.length, 3);
  await app.send("toggle", { enabled: false });
  app.stored.backfill.next_check = 0;
  app.events.alarm({ name: "retry-imports" });
  await app.idle();
  assert.equal(app.backfillCalls.length, 3);
  await app.send("toggle", { enabled: true });
  await app.idle();
  assert.equal(app.backfillCalls.length, 5);
  await app.send("logout");
  app.stored.backfill.next_check = 0;
  app.events.alarm({ name: "retry-imports" });
  await app.idle();
  assert.equal(app.backfillCalls.length, 5);
  assert.equal((await app.send("state")).backfill, null);
});

test("automatic backfill retries transient site failures without writing fabricated answers", async () => {
  const app = await setup();
  app.setBackfill(
    [{ id: "daily", kind: "daily", daily_date: "2026-10-09" }],
    async () => new Response("", { status: 503 }),
  );
  await app.send("login", { username: "alice", password: "password" });
  await app.idle();
  assert.equal(app.backfillCalls.length, 0);
  assert.match(app.stored.backfill.message, /retry/i);
  assert(app.stored.backfill.next_check > Date.now());
});
