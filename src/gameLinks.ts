import type { Game, Result } from "./types.ts";
import { madridToday } from "./scoring.ts";

export function timeguessrGameId(value: string): string | null {
  let id = value.trim();
  if (/^https?:\/\//i.test(id)) {
    try {
      const url = new URL(id);
      if (!["timeguessr.com", "www.timeguessr.com"].includes(url.hostname))
        return null;
      id = url.searchParams.get("RA") || "";
    } catch {
      return null;
    }
  } else {
    try {
      id = decodeURIComponent(id);
    } catch {
      return null;
    }
  }
  return /^[a-f0-9]{64}:[a-f0-9]{32}$/i.test(id) ? id.toLowerCase() : null;
}

export function gameReplayUrl(game: Game): string | null {
  if (game.kind === "daily")
    return game.daily_date === madridToday()
      ? "https://timeguessr.com/play?mode=daily"
      : null;
  const id = timeguessrGameId(game.name || "");
  return id
    ? `https://timeguessr.com/game-settings?RA=${encodeURIComponent(id)}`
    : null;
}

export function unplayedReplayGames(
  games: Game[],
  results: Result[],
  playerId: string | null,
) {
  if (!playerId) return [];
  const recorded = new Set(results.map((result) => result.game_id));
  const played = new Set(
    results
      .filter((result) => result.player_id === playerId)
      .map((result) => result.game_id),
  );
  return games.flatMap((game) => {
    const url = gameReplayUrl(game);
    return url && recorded.has(game.id) && !played.has(game.id)
      ? [{ game, url }]
      : [];
  });
}
