import type { Result } from "./types.ts";
import { yearDistribution, type FeaturedPicture } from "./featuredPictures.ts";

type Point = { readonly lat: number; readonly lng: number };
export type Located = FeaturedPicture & { readonly location: Point };
export type Dated = FeaturedPicture & { readonly year: number };

export const located = (pictures: readonly FeaturedPicture[]) =>
  pictures.filter((p): p is Located => p.location !== null);
export const dated = (pictures: readonly FeaturedPicture[]) =>
  pictures.filter((p): p is Dated => p.year !== null);

/** Most featured first, then alphabetical. */
export function countryCounts(pictures: readonly FeaturedPicture[]) {
  const counts = new Map<string, number>();
  for (const { country } of pictures)
    if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
  return [...counts]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

/** Every decade from the oldest to the newest picture, empty decades included. */
export function decades(pictures: readonly FeaturedPicture[]) {
  const years = yearDistribution(pictures);
  if (!years.length) return [];
  const first = Math.floor(years[0]!.year / 10) * 10;
  const last = Math.floor(years.at(-1)!.year / 10) * 10;
  return Array.from({ length: (last - first) / 10 + 1 }, (_, i) => {
    const decade = first + i * 10;
    return {
      decade,
      count: years
        .filter(({ year }) => year >= decade && year < decade + 10)
        .reduce((sum, { count }) => sum + count, 0),
    };
  });
}

/** The 1-2-3-5 round number closest to the target on a log scale. */
function roundBound(target: number) {
  const power = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 3, 5, 10]
    .map((m) => m * power)
    .reduce((best, bound) =>
      Math.abs(Math.log(bound / target)) < Math.abs(Math.log(best / target))
        ? bound
        : best,
    );
}

/**
 * Upper bounds of up to four color steps: a step of its own for single
 * pictures, two round log-spaced steps, and the busiest place last, so one
 * crowded place cannot wash out the rest of the map.
 */
export function colorSteps(max: number) {
  const steps = [1];
  for (let k = 1; k <= 2; k++) {
    const bound = roundBound(max ** (k / 3));
    if (bound > steps.at(-1)! && bound < max) steps.push(bound);
  }
  if (max > 1) steps.push(max);
  return steps;
}
export const stepOf = (count: number, steps: readonly number[]) =>
  steps.findIndex((bound) => count <= bound);
export const stepLabel = (steps: readonly number[], i: number) => {
  const low = i ? steps[i - 1]! + 1 : 1;
  return low === steps[i] ? String(low) : `${low}–${steps[i]}`;
};

/** Groups points into pointy-top hexagons of circumradius `r`, by nearest centre. */
export function hexBins<T>(
  items: readonly T[],
  at: (item: T) => { x: number; y: number },
  r: number,
) {
  const dx = r * Math.sqrt(3);
  const dy = r * 1.5;
  const bins = new Map<string, { x: number; y: number; items: T[] }>();
  for (const item of items) {
    const p = at(item);
    const row = Math.round(p.y / dy);
    let best = { col: 0, row: 0, d: Infinity };
    for (let j = row - 1; j <= row + 1; j++) {
      const shift = (Math.abs(j) % 2) / 2;
      const col = Math.round(p.x / dx - shift);
      const d = Math.hypot(p.x - (col + shift) * dx, p.y - j * dy);
      if (d < best.d) best = { col, row: j, d };
    }
    const key = `${best.col}:${best.row}`;
    const bin = bins.get(key) ?? {
      x: (best.col + (Math.abs(best.row) % 2) / 2) * dx,
      y: best.row * dy,
      items: [],
    };
    bin.items.push(item);
    bins.set(key, bin);
  }
  return [...bins].map(([key, bin]) => ({ key, ...bin }));
}

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

function roundsByPicture(results: readonly Result[]) {
  const rounds = new Map<string, NonNullable<Result["rounds"]>>();
  for (const result of results)
    result.rounds?.forEach((round, i) => {
      const key = `${result.game_id}:${i}`;
      rounds.set(key, [...(rounds.get(key) ?? []), round]);
    });
  return rounds;
}

/** Club averages per picture, from every player who shared picture details. */
export function pictureScores(
  pictures: readonly FeaturedPicture[],
  results: readonly Result[],
  minimumPlayers = 2,
) {
  const rounds = roundsByPicture(results);
  return pictures.flatMap((picture) => {
    const shared = rounds.get(`${picture.gameId}:${picture.round}`) ?? [];
    if (shared.length < minimumPlayers) return [];
    const points = shared.map((r) => r.points);
    return [
      {
        picture,
        players: shared.length,
        points: mean(points)!,
        spread: Math.max(...points) - Math.min(...points),
        exactYears: shared.filter((r) => r.years_off === 0).length,
        yearsOff: mean(
          shared.flatMap((r) => (r.years_off === null ? [] : [r.years_off])),
        ),
        kmOff: mean(
          shared.flatMap((r) =>
            r.distance_km === null ? [] : [r.distance_km],
          ),
        ),
      },
    ];
  });
}

/** The club's average years off for pictures from each decade. */
export function decadeAccuracy(
  pictures: readonly FeaturedPicture[],
  results: readonly Result[],
) {
  const rounds = roundsByPicture(results);
  const errors = new Map<number, number[]>();
  for (const picture of dated(pictures)) {
    const decade = Math.floor(picture.year / 10) * 10;
    for (const round of rounds.get(`${picture.gameId}:${picture.round}`) ?? [])
      if (round.years_off !== null)
        errors.set(decade, [...(errors.get(decade) ?? []), round.years_off]);
  }
  return new Map(
    [...errors].map(([decade, values]) => [decade, mean(values)!]),
  );
}

/** The latest date each country appeared, as ISO dates. */
export function countryLastSeen(
  pictures: readonly FeaturedPicture[],
  dateOf: (gameId: string) => string | null,
) {
  const seen = new Map<string, string>();
  for (const { country, gameId } of pictures) {
    const date = dateOf(gameId);
    if (country && date && date > (seen.get(country) ?? ""))
      seen.set(country, date);
  }
  return seen;
}
