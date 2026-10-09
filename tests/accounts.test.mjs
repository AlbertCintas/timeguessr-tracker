import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import ts from "typescript";
const tables = {
  invitations: [],
  profiles: [],
  administrators: [{ player_id: "admin" }],
};
const users = new Map();
let handler;
let failCreate = false;
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
  }
  update(value) {
    this.updateValue = value;
    return this;
  }
  insert(value) {
    this.insertValue = value;
    return this;
  }
  select() {
    return this;
  }
  eq(key, value) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  is(key, value) {
    this.filters.push((row) => (row[key] ?? null) === value);
    return this;
  }
  gt(key, value) {
    this.filters.push((row) => row[key] > value);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  then(resolve, reject) {
    try {
      const rows = tables[this.table].filter((row) =>
        this.filters.every((f) => f(row)),
      );
      if (this.updateValue)
        rows.forEach((row) => Object.assign(row, this.updateValue));
      if (this.insertValue) {
        tables[this.table].push({ ...this.insertValue });
      }
      return Promise.resolve({
        data: this.single ? (rows[0] ?? null) : rows,
        error: null,
      }).then(resolve, reject);
    } catch (e) {
      return Promise.reject(e).then(resolve, reject);
    }
  }
}
const mock = {
  from: (table) => new Query(table),
  auth: {
    getUser: async (token) => ({
      data: {
        user:
          token === "admin-token"
            ? { id: "admin" }
            : token === "player-token"
              ? { id: "player" }
              : null,
      },
      error: null,
    }),
    admin: {
      createUser: async (input) => {
        if (failCreate) return { data: null, error: new Error("duplicate") };
        const user = { id: crypto.randomUUID(), ...input };
        users.set(user.id, user);
        return { data: { user }, error: null };
      },
      deleteUser: async (id) => {
        users.delete(id);
        return { error: null };
      },
      updateUserById: async (id, changes) => {
        if (!users.has(id)) return { error: new Error("missing") };
        Object.assign(users.get(id), changes);
        return { error: null };
      },
    },
  },
};
globalThis.__accountMock = mock;
globalThis.Deno = {
  env: { get: () => "test" },
  serve: (fn) => {
    handler = fn;
  },
};
const source = (
  await readFile(
    new URL("../supabase/functions/accounts/index.ts", import.meta.url),
    "utf8",
  )
).replace(
  /import\s*\{\s*createClient\s*\}\s*from\s*"npm:[^"]+";/,
  "const createClient = () => globalThis.__accountMock;",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const request = async (body, token) => {
  const response = await handler(
    new Request("https://example.com/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
};
test("invitation redemption and account administration enforce authorization", async () => {
  assert.equal((await request({ action: "invite" })).status, 401);
  assert.equal(
    (await request({ action: "invite" }, "player-token")).status,
    403,
  );
  const invite = await request({ action: "invite" }, "admin-token");
  assert.equal(invite.status, 200);
  assert.match(invite.body.token, /^[a-f0-9]{64}$/);
  const record = tables.invitations[0];
  assert.equal(
    record.token_hash,
    createHash("sha256").update(invite.body.token).digest("hex"),
  );
  record.expires_at = new Date(Date.now() + 86400000).toISOString();
  assert.equal(
    (
      await request({
        action: "redeem",
        token: invite.body.token,
        username: "bad name",
        password: "long-password",
      })
    ).status,
    400,
  );
  failCreate = true;
  assert.equal(
    (
      await request({
        action: "redeem",
        token: invite.body.token,
        username: "alice",
        password: "long-password",
      })
    ).status,
    400,
  );
  assert.equal(record.used_at, null);
  failCreate = false;
  const redeemed = await request({
    action: "redeem",
    token: invite.body.token,
    username: "Alice",
    password: "long-password",
  });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.body.username, "alice");
  assert.equal(tables.profiles[0].username, "alice");
  assert.equal(
    (
      await request({
        action: "redeem",
        token: invite.body.token,
        username: "bob",
        password: "long-password",
      })
    ).status,
    400,
  );
  const id = tables.profiles[0].id;
  assert.equal(
    (
      await request(
        {
          action: "reset-password",
          player_id: id,
          password: "replacement-password",
        },
        "player-token",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        { action: "reset-password", player_id: id, password: "short" },
        "admin-token",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        {
          action: "reset-password",
          player_id: id,
          password: "replacement-password",
        },
        "admin-token",
      )
    ).status,
    200,
  );
  assert.equal(users.get(id).password, "replacement-password");
  const expired = await request({ action: "invite" }, "admin-token");
  tables.invitations.at(-1).expires_at = "2000-01-01T00:00:00Z";
  assert.equal(
    (
      await request({
        action: "redeem",
        token: expired.body.token,
        username: "bob",
        password: "long-password",
      })
    ).status,
    400,
  );
});
