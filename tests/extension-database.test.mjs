import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("transactional imports preserve old data, enforce ownership, enrich details and keep conflicts", async () => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111",
    bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      alter default privileges in schema public grant execute on functions to anon,authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;
      create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    for (const file of [
      "202610090001_club.sql",
      "202610090002_picture_results.sql",
      "202610090003_extension_import.sql",
      "202610090003_extension_import.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, name] of [
      [alice, "alice"],
      [bob, "bob"],
    ]) {
      await db.query("insert into auth.users values($1)", [id]);
      await db.query(
        "insert into profiles(id,username,display_name) values($1,$2,$2)",
        [id, name],
      );
    }
    async function as(id, role = "authenticated") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec(`set role ${role}`);
    }
    const rounds = Array.from({ length: 5 }, () => ({
      points: 4000,
      years_off: 0,
      distance_km: 1.3,
    }));
    const importGame = async (overrides = {}) =>
      (
        await db.query(
          "select import_timeguessr_result($1,$2,$3,$4,$5,$6,$7) as result",
          Object.values({
            date: "2026-10-09",
            number: 1227,
            key: null,
            played: "2026-10-09",
            total: 20000,
            rounds: JSON.stringify(rounds),
            timer: 0,
            ...overrides,
          }),
        )
      ).rows[0].result;
    await as(alice);
    const saved = await importGame();
    assert.equal(saved.status, "saved");
    assert.equal((await importGame()).status, "already_saved");
    assert.equal((await db.query("select * from results")).rows.length, 1);
    assert.equal(
      (
        await importGame({
          total: 15000,
          rounds: JSON.stringify(rounds.map((r) => ({ ...r, points: 3000 }))),
        })
      ).status,
      "conflict",
    );
    assert.equal(
      (await db.query("select points from results")).rows[0].points,
      20000,
    );
    await db.query(
      "update results set rounds=null,daily_number=null where game_id=$1",
      [saved.game_id],
    );
    assert.equal((await importGame()).status, "enriched");
    await db.query("update results set rounds=$1 where game_id=$2", [
      JSON.stringify(
        rounds.map((r) => ({ ...r, years_off: null, distance_km: null })),
      ),
      saved.game_id,
    ]);
    assert.equal((await importGame()).status, "enriched");
    assert.equal(
      (await db.query("select rounds from results")).rows[0].rounds[0]
        .years_off,
      0,
    );
    assert.equal(
      (
        await importGame({
          rounds: JSON.stringify(rounds.map((r) => ({ ...r, years_off: 100 }))),
        })
      ).status,
      "conflict",
    );
    await assert.rejects(importGame({ date: "2999-10-08" }));
    await assert.rejects(importGame({ rounds: null }));
    await assert.rejects(importGame({ total: 0, rounds: "[]" }));
    const custom = {
      date: null,
      number: null,
      key: "timeguessr:v1:" + "a".repeat(64),
      played: "2026-10-08",
    };
    const customSaved = await importGame(custom);
    assert.equal(customSaved.status, "saved");
    assert.equal(
      (await importGame({ ...custom, played: "2026-10-09" })).game_id,
      customSaved.game_id,
    );
    assert.equal(
      (
        await db.query("select played_on::text as day from games where id=$1", [
          customSaved.game_id,
        ])
      ).rows[0].day,
      "2026-10-08",
    );
    const manual = (
      await db.query("select get_or_create_game(null,'My random game') as id")
    ).rows[0].id;
    assert.notEqual(manual, customSaved.game_id);
    await as(bob);
    assert.equal((await importGame()).status, "saved");
    assert.equal((await importGame()).game_id, saved.game_id);
    const players = (
      await db.query("select player_id from results where game_id=$1", [
        saved.game_id,
      ])
    ).rows
      .map((r) => r.player_id)
      .sort();
    assert.deepEqual(players, [alice, bob].sort());
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.import_timeguessr_result(date,integer,text,date,integer,jsonb,integer)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await as("", "anon");
    await assert.rejects(importGame());
    await as("33333333-3333-4333-8333-333333333333");
    await assert.rejects(importGame());
    await as(alice);
    assert.equal(
      (await db.query("select * from games where id=$1", [manual])).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
