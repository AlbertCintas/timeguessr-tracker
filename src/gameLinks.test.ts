import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gameReplayUrl,
  timeguessrGameId,
  unplayedReplayGames,
} from "./gameLinks.ts";
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

test("random replay candidates exclude played games, missing results and invalid links", () => {
  const candidates = [
    game,
    { ...game, id: "unplayed" },
    { ...game, id: "empty" },
    { ...game, id: "invalid", name: "Truncated ID" },
  ];
  const results = [
    { game_id: game.id, player_id: "me", points: 0 },
    { game_id: "unplayed", player_id: "friend", points: 10000 },
    { game_id: "invalid", player_id: "friend", points: 10000 },
  ];
  assert.deepEqual(
    unplayedReplayGames(candidates, results, "me").map(({ game }) => game.id),
    ["unplayed"],
  );
  assert.deepEqual(unplayedReplayGames(candidates, results, null), []);
  assert.deepEqual(
    unplayedReplayGames(
      candidates,
      [...results, { game_id: "unplayed", player_id: "me", points: 10000 }],
      "me",
    ),
    [],
  );
});
