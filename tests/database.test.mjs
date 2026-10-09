import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
test("PostgreSQL schema, result ownership, game uniqueness, and avatar permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon, authenticated;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610090001_club.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const [index, id] of ids.entries()) {
      await db.query("insert into auth.users values ($1)", [id]);
      await db.query(
        "insert into public.profiles(id,username,display_name) values($1,$2,$2)",
        [id, `player${index}`],
      );
    }
    await db.query("insert into public.administrators values($1)", [ids[2]]);
    const as = async (role, id = "") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec(`set role ${role}`);
    };
    await as("authenticated", ids[0]);
    const create = () =>
      db.query("select public.get_or_create_game('2026-01-01',null) as id");
    const game = (await create()).rows[0].id;
    assert.equal((await create()).rows[0].id, game);
    await assert.rejects(
      db.query("select public.get_or_create_game('2999-01-01',null)"),
    );
    await assert.rejects(
      db.query("insert into results values($1,$2,10)", [game, ids[1]]),
    );
    await db.query("insert into results values($1,$2,10)", [game, ids[0]]);
    await assert.rejects(
      db.query("insert into results values($1,$2,20)", [game, ids[0]]),
    );
    await assert.rejects(
      db.query("update profiles set username=$1 where id=$2", [
        "hacked",
        ids[0],
      ]),
    );
    await assert.rejects(
      db.query("insert into administrators values($1)", [ids[0]]),
    );
    await assert.rejects(db.query("select * from invitations"));
    await db.query("update profiles set display_name=$1 where id=$2", [
      "Player Zero",
      ids[0],
    ]);
    await db.query(
      "insert into storage.objects(bucket_id,name) values('avatars',$1)",
      [`${ids[0]}/photo.png`],
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name) values('avatars',$1)",
        [`${ids[1]}/photo.png`],
      ),
    );
    await as("authenticated", ids[1]);
    await db.query("update results set points=999 where game_id=$1", [game]);
    assert.equal(
      (await db.query("select points from results")).rows[0].points,
      10,
    );
    await db.query("delete from results where game_id=$1", [game]);
    assert.equal((await db.query("select * from results")).rows.length, 1);
    await db.query("delete from storage.objects");
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("insert into results values($1,$2,-1)", [game, ids[1]]),
    );
    await as("authenticated", ids[2]);
    await db.query("update results set points=20 where game_id=$1", [game]);
    assert.equal(
      (await db.query("select points from results")).rows[0].points,
      20,
    );
    await as("anon");
    assert.equal((await db.query("select * from profiles")).rows.length, 3);
    await assert.rejects(db.query("delete from results"));
    await assert.rejects(create());
    await as("authenticated", ids[2]);
    await db.query("delete from results where game_id=$1", [game]);
    assert.equal((await db.query("select * from results")).rows.length, 0);
  } finally {
    await db.close();
  }
});
