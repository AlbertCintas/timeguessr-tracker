import type { PictureResult, Result } from "./types.ts";

/** One answer per game and round, independent of the number of players. */
export interface FeaturedPicture {
  readonly year: number | null;
  readonly location: { readonly lat: number; readonly lng: number } | null;
}

/** Merge incomplete imports by game/round; omit conflicting answer fields. */
export function featuredPictures(
  results: readonly Result[],
): FeaturedPicture[] {
  const pictures = new Map<string, PictureResult[]>();
  for (const result of results) {
    result.rounds?.forEach((round, index) => {
      const key = `${result.game_id}:${index}`;
      const entries = pictures.get(key) ?? [];
      entries.push(round);
      pictures.set(key, entries);
    });
  }
  return [...pictures.values()].map((entries) => {
    const years = new Set(
      entries.flatMap((r) => (r.actual_year == null ? [] : [r.actual_year])),
    );
    const locations = new Map(
      entries.flatMap((r) =>
        r.actual_location == null
          ? []
          : [
              [
                JSON.stringify([r.actual_location.lat, r.actual_location.lng]),
                r.actual_location,
              ] as const,
            ],
      ),
    );
    return {
      year: years.size === 1 ? ([...years][0] ?? null) : null,
      location:
        locations.size === 1 ? ([...locations.values()][0] ?? null) : null,
    };
  });
}

/** Count exact answer years in chronological order. */
export function yearDistribution(pictures: readonly FeaturedPicture[]) {
  const counts = new Map<number, number>();
  for (const { year } of pictures) {
    if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([year, count]) => ({ year, count }));
}

/** Bin answers into five-degree geographic cells, including the poles and dateline. */
export function locationDensity(pictures: readonly FeaturedPicture[]) {
  const cells = new Map<string, { lat: number; lng: number; count: number }>();
  for (const { location } of pictures) {
    if (location === null) continue;
    const lat = Math.min(85, Math.floor(location.lat / 5) * 5);
    const lng =
      Math.floor((location.lng === 180 ? -180 : location.lng) / 5) * 5;
    const key = `${lat}:${lng}`;
    const cell = cells.get(key) ?? { lat, lng, count: 0 };
    cell.count++;
    cells.set(key, cell);
  }
  return [...cells.values()].sort(
    (a, b) => b.count - a.count || a.lat - b.lat || a.lng - b.lng,
  );
}
