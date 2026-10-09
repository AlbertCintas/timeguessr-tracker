import type { Game, Profile, Result, Standing } from "./types.ts";
export function standings(profiles: Profile[], results: Result[]): Standing[] {
  const best = new Map<string, number>();
  for (const r of results)
    best.set(r.game_id, Math.max(best.get(r.game_id) ?? -1, r.points));
  return profiles.map((p) => {
    const entries = results.filter((r) => r.player_id === p.id);
    const wins = entries.filter((r) => r.points === best.get(r.game_id)).length;
    const points = entries.reduce((sum, r) => sum + r.points, 0);
    return {
      ...p,
      games: entries.length,
      wins,
      points,
      winRate: entries.length ? (wins / entries.length) * 100 : 0,
      average: entries.length ? points / entries.length : 0,
    };
  });
}
export function ranked(
  rows: Standing[],
  metric: "wins" | "points" | "winRate" | "average",
) {
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.games > 0) - Number(a.games > 0) ||
      b[metric] - a[metric] ||
      a.display_name.localeCompare(b.display_name),
  );
  return sorted.map((row, index) => ({
    ...row,
    rank: row.games
      ? sorted.findIndex((r) => r.games > 0 && r[metric] === row[metric]) + 1
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
      .filter((game) => {
        const date =
          game.kind === "daily"
            ? game.daily_date!
            : game.played_on || madridToday(new Date(game.created_at));
        return date >= from && date <= today;
      })
      .map((game) => game.id),
  );
  return results.filter((result) => gameIds.has(result.game_id));
}
