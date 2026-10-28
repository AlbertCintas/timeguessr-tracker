export type Places = {
  readonly regions: readonly (readonly [country: string, name: string])[];
  readonly places: readonly (readonly [
    name: string,
    region: number,
    lat: number,
    lng: number,
    thousands: number,
  ])[];
};

const nearbyKm = 5;

let loading: Promise<Places> | null = null;
export const loadPlaces = () =>
  (loading ??= fetch(`${import.meta.env.BASE_URL}world-places.json`).then(
    (response) => {
      if (!response.ok)
        throw new Error(`world-places.json: ${response.status}`);
      return response.json() as Promise<Places>;
    },
  ));

/**
 * "Town, Region" for a location: the biggest town of 15,000+ people within
 * 5 km, else the nearest one. The picture's own country is searched first
 * so border pictures keep their country.
 */
export function placeName(
  data: Places,
  lat: number,
  lng: number,
  country: string | null,
) {
  const scale = Math.cos((lat * Math.PI) / 180);
  const km = (place: Places["places"][number]) => {
    const dLng = ((place[3] - lng + 540) % 360) - 180;
    return Math.hypot(place[2] - lat, dLng * scale) * 111.2;
  };
  for (const pass of country ? [country, null] : [null]) {
    const candidates = data.places.filter(
      (place) => !pass || data.regions[place[1]]![0] === pass,
    );
    if (!candidates.length) continue;
    const near = candidates.filter((place) => km(place) <= nearbyKm);
    const best = near.length
      ? near.reduce((a, b) => (b[4] > a[4] ? b : a))
      : candidates.reduce((a, b) => (km(b) < km(a) ? b : a));
    const region = data.regions[best[1]]![1];
    return !region || region === best[0] ? best[0] : `${best[0]}, ${region}`;
  }
  return null;
}
