import type { CorrectAnswer, Game, PictureResult, Result } from "./types.ts";

/** One answer per game and round, independent of the number of players. */
export interface FeaturedPicture {
  readonly gameId: string;
  readonly round: number;
  readonly year: number | null;
  readonly location: { readonly lat: number; readonly lng: number } | null;
  readonly country: string | null;
  readonly description: string | null;
}

/** Prefer backfilled site answers, then merge captures by game/round and omit conflicting fields. */
export function featuredPictures(
  results: readonly Result[],
  games: readonly Game[] = [],
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
  const played = new Set(results.map((r) => r.game_id));
  const originals = new Map<string, CorrectAnswer>();
  for (const game of games) {
    if (!played.has(game.id)) continue;
    // Timeguessr has five pictures even when only a total score was submitted.
    for (let index = 0; index < 5; index++) {
      const key = `${game.id}:${index}`;
      if (!pictures.has(key)) pictures.set(key, []);
    }
    game.correct_answers?.forEach((answer, index) => {
      const key = `${game.id}:${index}`;
      originals.set(key, answer);
      if (!pictures.has(key)) pictures.set(key, []);
    });
  }
  return [...pictures].map(([key, entries]) => {
    const original = originals.get(key);
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
    const split = key.lastIndexOf(":");
    return {
      gameId: key.slice(0, split),
      round: Number(key.slice(split + 1)),
      year:
        original?.actual_year ??
        (years.size === 1 ? ([...years][0] ?? null) : null),
      location:
        original?.actual_location ??
        (locations.size === 1 ? ([...locations.values()][0] ?? null) : null),
      country: original?.country ?? null,
      description: original?.description ?? null,
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

/** Bin answers into square geographic cells, including the poles and dateline. */
export function locationDensity(
  pictures: readonly Pick<FeaturedPicture, "location">[],
  size = 5,
) {
  const cells = new Map<string, { lat: number; lng: number; count: number }>();
  for (const { location } of pictures) {
    if (location === null) continue;
    const lat = Math.min(90 - size, Math.floor(location.lat / size) * size);
    const lng =
      Math.floor((location.lng === 180 ? -180 : location.lng) / size) * size;
    const key = `${lat}:${lng}`;
    const cell = cells.get(key) ?? { lat, lng, count: 0 };
    cell.count++;
    cells.set(key, cell);
  }
  return [...cells.values()].sort(
    (a, b) => b.count - a.count || a.lat - b.lat || a.lng - b.lng,
  );
}
