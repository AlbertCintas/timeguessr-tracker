import type { Profile, Result } from "./types.ts";

export const shameMetrics = {
  worstGame: {
    label: "Worst game",
    description: "Your lowest game total. A five-picture cry for help.",
    unit: "pts",
    ascending: true,
  },
  worstPicture: {
    label: "Worst picture",
    description: "Your lowest picture score. One photo, no survivors.",
    unit: "pts",
    ascending: true,
  },
  zeros: {
    label: "Most zero-point pictures",
    description:
      "Pictures scoring exactly zero overall. Rock bottom has a counter.",
    unit: "zeros",
    ascending: false,
  },
  years: {
    label: "Most years off",
    description:
      "Your biggest single-picture year error. Different century, same confidence.",
    unit: "years",
    ascending: false,
  },
  distance: {
    label: "Furthest guess",
    description:
      "Your biggest single-picture distance error. Geography has filed a restraining order.",
    unit: "km",
    ascending: false,
  },
} as const;
export type ShameMetric = keyof typeof shameMetrics;

export function shameRankings(
  profiles: Profile[],
  results: Result[],
  metric: ShameMetric,
) {
  const rows = profiles
    .flatMap((profile) => {
      const games = results.filter((result) => result.player_id === profile.id);
      const pictures = games.flatMap((game) =>
        (game.rounds ?? []).map((round, index) => ({
          ...round,
          gameId: game.game_id,
          picture: index + 1,
        })),
      );
      const samples =
        metric === "worstGame"
          ? games.map((game) => ({
              value: game.points,
              gameId: game.game_id,
              picture: null as number | null,
            }))
          : pictures.flatMap((round) => {
              const value =
                metric === "years"
                  ? round.years_off
                  : metric === "distance"
                    ? round.distance_km
                    : round.points;
              return value === null
                ? []
                : [{ value, gameId: round.gameId, picture: round.picture }];
            });
      if (!samples.length) return [];
      const ascending = shameMetrics[metric].ascending;
      const worst = [...samples].sort((a, b) =>
        ascending ? a.value - b.value : b.value - a.value,
      )[0];
      return [
        {
          ...profile,
          value:
            metric === "zeros"
              ? pictures.filter((round) => round.points === 0).length
              : worst.value,
          samples: samples.length,
          gameId: metric === "zeros" ? null : worst.gameId,
          picture: metric === "zeros" ? null : worst.picture,
        },
      ];
    })
    .sort(
      (a, b) =>
        (shameMetrics[metric].ascending
          ? a.value - b.value
          : b.value - a.value) || a.display_name.localeCompare(b.display_name),
    );
  return rows.map((row) => ({
    ...row,
    rank: rows.findIndex((other) => other.value === row.value) + 1,
  }));
}
