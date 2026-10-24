import { standings } from "./scoring.ts";
import type { Profile, Result } from "./types.ts";

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export function playerStats(profiles: Profile[], results: Result[]) {
  return standings(profiles, results)
    .filter((row) => row.games > 0)
    .map((row) => {
      const entries = results.filter((result) => result.player_id === row.id);
      const pictures = entries.flatMap((entry) => entry.rounds ?? []);
      const years = pictures.flatMap((p) =>
        p.years_off === null ? [] : [p.years_off],
      );
      const distances = pictures.flatMap((p) =>
        p.distance_km === null ? [] : [p.distance_km],
      );
      const points = entries.map((entry) => entry.points);
      return {
        ...row,
        bestGame: Math.max(...points),
        worstGame: Math.min(...points),
        pictures: pictures.length,
        avgPicture: mean(pictures.map((p) => p.points)),
        avgYears: mean(years),
        avgDistance: mean(distances),
        exactYears: years.filter((y) => y === 0).length,
        perfect: pictures.filter((p) => p.points === 10000).length,
        zeros: pictures.filter((p) => p.points === 0).length,
        closest: distances.length ? Math.min(...distances) : null,
      };
    })
    .sort(
      (a, b) =>
        b.games - a.games || a.display_name.localeCompare(b.display_name),
    );
}
