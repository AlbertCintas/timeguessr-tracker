import type { Game, Profile, Result, Standing } from "./types.ts";
export const perfectLocationKm = 0.05;
export function standings(profiles: Profile[], results: Result[]): Standing[] {
  const best = new Map<string, number>();
  const scores = new Map<string, number[]>();
  for (const r of results) {
    best.set(r.game_id, Math.max(best.get(r.game_id) ?? -1, r.points));
    scores.set(r.game_id, [...(scores.get(r.game_id) ?? []), r.points]);
  }
  const players = new Map([...scores].map(([id, s]) => [id, s.length]));
  const clubPointsFor = (r: Result) => {
    const others = scores.get(r.game_id)!;
    const outscored =
      others.filter((s) => s < r.points).length +
      (others.filter((s) => s === r.points).length - 1) / 2;
    return outscored + (r.points === best.get(r.game_id) ? 1 : 0);
  };
  return profiles.map((p) => {
    const entries = results.filter((r) => r.player_id === p.id);
    const contested = entries.filter((r) => players.get(r.game_id)! > 1);
    const wins = contested.filter((r) => r.points === best.get(r.game_id));
    const points = entries.reduce((sum, r) => sum + r.points, 0);
    const clubPoints = contested.reduce((sum, r) => sum + clubPointsFor(r), 0);
    const clubMax = contested.reduce(
      (sum, r) => sum + players.get(r.game_id)!,
      0,
    );
    return {
      ...p,
      games: entries.length,
      contested: contested.length,
      wins: wins.length,
      points,
      winRate: contested.length ? (wins.length / contested.length) * 100 : 0,
      average: entries.length ? points / entries.length : 0,
      clubPoints,
      clubMax,
      clubRate: clubMax ? (clubPoints / clubMax) * 100 : 0,
      clubAverage: contested.length ? clubPoints / contested.length : 0,
    };
  });
}
export type RankMetric =
  "wins" | "points" | "winRate" | "average" | "clubRate" | "clubAverage";
export function ranked(rows: Standing[], metric: RankMetric) {
  const counts = (row: Standing) =>
    metric !== "points" && metric !== "average"
      ? row.contested > 0
      : row.games > 0;
  const sorted = [...rows].sort(
    (a, b) =>
      Number(counts(b)) - Number(counts(a)) ||
      b[metric] - a[metric] ||
      (metric === "wins" ? b.points - a.points : 0) ||
      a.display_name.localeCompare(b.display_name),
  );
  return sorted.map((row, index) => ({
    ...row,
    rank: counts(row)
      ? sorted.findIndex((r) => counts(r) && r[metric] === row[metric]) + 1
      : null,
    position: index,
  }));
}
export function madridToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Madrid date of a daily game, or the day a non-daily game was first played. */
export const gameDay = (game: Game) =>
  game.kind === "daily"
    ? game.daily_date!
    : game.played_on || madridToday(new Date(game.created_at));

export function europeanDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
}
export function parseEuropeanDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `20${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

export const periodLabels = {
  all: "All time",
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  last7: "Last 7 days",
  last30: "Last 30 days",
} as const;
export type StandingsPeriod = keyof typeof periodLabels;

export function resultsForPeriod(
  games: Game[],
  results: Result[],
  period: StandingsPeriod,
  now = new Date(),
): Result[] {
  if (period === "all") return results;
  const today = madridToday(now);
  const start = new Date(`${today}T12:00:00Z`);
  if (period === "week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else if (period === "month") start.setUTCDate(1);
  else if (period === "year") start.setUTCMonth(0, 1);
  else if (period === "last7" || period === "last30")
    start.setUTCDate(start.getUTCDate() - (period === "last7" ? 6 : 29));
  const from = start.toISOString().slice(0, 10);
  const gameIds = new Set(
    games
      .filter((game) => gameDay(game) >= from && gameDay(game) <= today)
      .map((game) => game.id),
  );
  return results.filter((result) => gameIds.has(result.game_id));
}
