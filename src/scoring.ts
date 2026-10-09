import type { Profile, Result, Standing } from "./types.ts";
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
