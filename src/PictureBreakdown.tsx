import type { PictureResult } from "./types";
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
export function PictureBreakdown({ rounds }: { rounds: PictureResult[] }) {
  return (
    <table className="picture-breakdown">
      <caption>Picture breakdown</caption>
      <thead>
        <tr>
          <th scope="col">Picture</th>
          <th scope="col">Points</th>
          <th scope="col">Years off</th>
          <th scope="col">Km off</th>
        </tr>
      </thead>
      <tbody>
        {rounds.map((round, index) => (
          <tr key={index}>
            <th scope="row">{index + 1}</th>
            <td>{number.format(round.points)}</td>
            <td>
              {round.years_off === null ? "—" : number.format(round.years_off)}
            </td>
            <td>
              {round.distance_km === null
                ? "—"
                : number.format(round.distance_km)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
