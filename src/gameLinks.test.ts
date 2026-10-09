import { test } from "node:test";
import assert from "node:assert/strict";
import { gameReplayUrl, timeguessrGameId } from "./gameLinks.ts";
import { madridToday } from "./scoring.ts";
import type { Game } from "./types.ts";

const id = `${"a".repeat(64)}:${"b".repeat(32)}`;
const game: Game = {
  id: "game",
  kind: "custom",
  name: id,
  daily_date: null,
  created_at: "2026-10-09T12:00:00Z",
};

test("challenge IDs round-trip through raw, encoded and localized share links", () => {
  for (const input of [
    id,
    encodeURIComponent(id),
    `https://timeguessr.com/es/game-settings?RA=${encodeURIComponent(id)}`,
    id.toUpperCase(),
  ])
    assert.equal(timeguessrGameId(input), id);
  assert.equal(
    gameReplayUrl(game),
    `https://timeguessr.com/game-settings?RA=${encodeURIComponent(id)}`,
  );
});

test("truncated IDs, unrelated URLs and unsafe schemes never become replay links", () => {
  for (const input of [
    "a".repeat(64),
    "Friday game",
    `https://example.com/?RA=${id}`,
    `https://timeguessr.com.evil.test/?RA=${id}`,
    `javascript:alert(1)`,
    "%broken",
  ])
    assert.equal(timeguessrGameId(input), null);
  assert.equal(gameReplayUrl({ ...game, name: "Friday game" }), null);
});

test("daily replay links point to today's challenge only", () => {
  assert.equal(
    gameReplayUrl({
      ...game,
      kind: "daily",
      name: null,
      daily_date: madridToday(),
    }),
    "https://timeguessr.com/play?mode=daily",
  );
  assert.equal(
    gameReplayUrl({
      ...game,
      kind: "daily",
      name: null,
      daily_date: "2023-06-01",
    }),
    null,
  );
});
