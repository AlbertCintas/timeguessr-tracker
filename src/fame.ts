import { perfectLocationKm } from "./scoring.ts";
import type { Game, Profile, Result } from "./types.ts";

export const minimumDetailedGames = 5;

export const fameMetrics = {
  avgYears: {
    label: "Lowest average years off",
    quip: "Great with dates. Historical ones only.",
    unit: "years avg",
    ascending: true,
  },
  avgDistance: {
    label: "Lowest average distance",
    quip: "Always knows where they are. Nobody asked.",
    unit: "km avg",
    ascending: true,
  },
  exactYears: {
    label: "Best exact-year rate",
    quip: "Perfect timing. Except in life.",
    unit: "exact",
    ascending: false,
  },
  perfectLocations: {
    label: "Best perfect-location rate",
    quip: "Spot on. Still can’t find their keys.",
    unit: "within 50 m",
    ascending: false,
  },
  closest: {
    label: "Closest guess",
    quip: "Closer than their family has ever been.",
    unit: "m",
    ascending: true,
  },
  bestGame: {
    label: "Best game",
    quip: "Peaked. It’s all downhill from here.",
    unit: "pts",
    ascending: false,
  },
  perfect: {
    label: "Best perfect-picture rate",
    quip: "Even a broken clock.",
    unit: "perfect",
    ascending: false,
  },
  streak: {
    label: "Longest daily win streak",
    quip: "Touch grass.",
    unit: "days",
    ascending: false,
  },
} as const;
export type FameMetric = keyof typeof fameMetrics;

export const rateMetrics: FameMetric[] = [
  "exactYears",
  "perfectLocations",
  "perfect",
];

type Sample = { value: number; gameId: string | null; picture: number | null };
type FameRecord = Sample & { samples: number; count?: number };

const enoughGames = (samples: Sample[]) =>
  new Set(samples.map((sample) => sample.gameId)).size >= minimumDetailedGames;

function longestDailyStreak(
  entries: Result[],
  results: Result[],
  games: Game[],
) {
  const best = new Map<string, number>();
  for (const r of results)
    best.set(r.game_id, Math.max(best.get(r.game_id) ?? -1, r.points));
  const dates = entries
    .filter((entry) => entry.points === best.get(entry.game_id))
    .map((entry) => games.find((game) => game.id === entry.game_id))
    .filter((game) => game?.kind === "daily" && game.daily_date)
    .map((game) => Date.parse(`${game!.daily_date}T12:00:00Z`))
    .sort((a, b) => a - b);
  let longest = 0,
    current = 0;
  dates.forEach((date, index) => {
    current = index && date - dates[index - 1] === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
  });
  return longest;
}

export const fameRankings = (
  profiles: Profile[],
  results: Result[],
  games: Game[],
  metric: FameMetric,
) =>
  recordRankings(
    profiles,
    results,
    games,
    metric,
    fameMetrics[metric].ascending,
  );

export function recordRankings(
  profiles: Profile[],
  results: Result[],
  games: Game[],
  metric: FameMetric,
  ascending: boolean,
) {
  const rows = profiles
    .flatMap((profile) => {
      const entries = results.filter(
        (result) => result.player_id === profile.id,
      );
      if (!entries.length) return [];
      const pictures = entries.flatMap((entry) =>
        (entry.rounds ?? []).map((round, index) => ({
          ...round,
          gameId: entry.game_id,
          picture: index + 1,
        })),
      );
      const field = (key: "points" | "years_off" | "distance_km"): Sample[] =>
        pictures.flatMap((round) =>
          round[key] === null
            ? []
            : [
                {
                  value: round[key]!,
                  gameId: round.gameId,
                  picture: round.picture,
                },
              ],
        );
      const total = (samples: number, value: number) => ({
        value,
        samples,
        gameId: null,
        picture: null,
      });
      const average = (samples: Sample[]) =>
        enoughGames(samples)
          ? {
              value:
                samples.reduce((sum, sample) => sum + sample.value, 0) /
                samples.length,
              samples: samples.length,
              gameId: null,
              picture: null,
            }
          : null;
      const rate = (samples: Sample[], hit: (value: number) => boolean) => {
        if (!enoughGames(samples)) return null;
        const count = samples.filter((sample) => hit(sample.value)).length;
        return {
          value: count / samples.length,
          count,
          samples: samples.length,
          gameId: null,
          picture: null,
        };
      };
      const extreme = (samples: Sample[]) =>
        samples.length
          ? {
              ...[...samples].sort((a, b) =>
                ascending ? a.value - b.value : b.value - a.value,
              )[0],
              samples: samples.length,
            }
          : null;
      const years = field("years_off"),
        distances = field("distance_km"),
        scores = field("points");
      const record: FameRecord | null =
        metric === "avgYears"
          ? average(years)
          : metric === "avgDistance"
            ? average(distances)
            : metric === "exactYears"
              ? rate(years, (value) => value === 0)
              : metric === "perfectLocations"
                ? rate(distances, (value) => value <= perfectLocationKm)
                : metric === "closest"
                  ? extreme(distances)
                  : metric === "bestGame"
                    ? extreme(
                        entries.map((entry) => ({
                          value: entry.points,
                          gameId: entry.game_id,
                          picture: null,
                        })),
                      )
                    : metric === "perfect"
                      ? rate(scores, (value) => value === 10000)
                      : total(
                          entries.length,
                          longestDailyStreak(entries, results, games),
                        );
      return record ? [{ ...profile, ...record }] : [];
    })
    .sort(
      (a, b) =>
        (ascending ? a.value - b.value : b.value - a.value) ||
        a.display_name.localeCompare(b.display_name),
    );
  return rows.map((row) => ({
    ...row,
    rank: rows.findIndex((other) => other.value === row.value) + 1,
  }));
}
