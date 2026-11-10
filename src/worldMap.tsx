export const x = (lng: number) => (lng + 180) * 2;
export const y = (lat: number) => (90 - lat) * 2;
export const land = (
  <image
    href={`${import.meta.env.BASE_URL}world-land.svg`}
    width="720"
    height="360"
  />
);
