import type { Game, PictureResult, Profile, Result } from "./types.ts";

export const minimumAveragePictures = 20;

export const fameMetrics = {
  avgYears: {
    label: "Human carbon dating",
    description: "Lowest average years off per picture.",
    unit: "years avg",
    ascending: true,
  },
  avgDistance: {
    label: "Human GPS",
    description: "Lowest average distance per picture.",
    unit: "km avg",
    ascending: true,
  },
  exactYears: {
    label: "Most exact years",
    description: "Pictures guessed to the exact year.",
    unit: "exact",
    ascending: false,
  },
  closest: {
    label: "Closest guess",
    description: "Smallest distance on a single picture.",
    unit: "km",
    ascending: true,
  },
  bestGame: {
    label: "Best game",
    description: "Highest game total.",
    unit: "pts",
    ascending: false,
  },
  perfect: {
    label: "Most perfect pictures",
    description: "Pictures scoring the full 10,000 points.",
    unit: "perfect",
    ascending: false,
  },
  streak: {
    label: "Longest daily win streak",
    description: "Consecutive daily challenges won. Ties count as wins.",
    unit: "days",
    ascending: false,
  },
} as const;
export type FameMetric = keyof typeof fameMetrics;

const optionalMetrics: FameMetric[] = ["exactYears", "perfect"];
export const hiddenWhenZero = (metric: FameMetric) =>
  optionalMetrics.includes(metric);

type Sample = { value: number; gameId: string | null; picture: number | null };

function longestDailyStreak(
  entries: Result[],
  results: Result[],
  games: Game[],
) {
  const best = new Map<string, number>();
  for (const r of results)
    best.set(r.game_id, Math.max(best.get(r.game_id) ?? -1, r.points));
  const wonDates = entries
    .filter((entry) => entry.points === best.get(entry.game_id))
    .map((entry) => games.find((game) => game.id === entry.game_id))
    .filter((game) => game?.kind === "daily" && game.daily_date)
    .map((game) => Date.parse(`${game!.daily_date}T12:00:00Z`))
    .sort((a, b) => a - b);
  let longest = 0,
    current = 0;
  wonDates.forEach((date, index) => {
    current =
      index && date - wonDates[index - 1] === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
  });
  return longest;
}

export function fameRankings(
  profiles: Profile[],
  results: Result[],
  games: Game[],
  metric: FameMetric,
) {
  const { ascending } = fameMetrics[metric];
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
      const field = (key: keyof PictureResult): Sample[] =>
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
        samples.length < minimumAveragePictures
          ? null
          : {
              value:
                samples.reduce((sum, sample) => sum + sample.value, 0) /
                samples.length,
              samples: samples.length,
              gameId: null,
              picture: null,
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
      const record =
        metric === "avgYears"
          ? average(years)
          : metric === "avgDistance"
            ? average(distances)
            : metric === "exactYears"
              ? total(years.length, years.filter((s) => s.value === 0).length)
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
                    ? total(
                        scores.length,
                        scores.filter((s) => s.value === 10000).length,
                      )
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
