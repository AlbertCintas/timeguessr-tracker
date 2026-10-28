import type { PictureResult } from "./types";
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
/** Display scores, guess errors and captured correct answers for every round. */
export function PictureBreakdown({ rounds }: { rounds: PictureResult[] }) {
  return (
    <div className="picture-breakdown-scroll">
      <table className="picture-breakdown">
        <caption>Picture breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Picture</th>
            <th scope="col">Points</th>
            <th scope="col">Years off</th>
            <th scope="col">Km off</th>
            <th scope="col">Correct year</th>
            <th scope="col">Correct location</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round, index) => (
            <tr key={index}>
              <th scope="row">{index + 1}</th>
              <td>{number.format(round.points)}</td>
              <td>
                {round.years_off === null
                  ? "—"
                  : number.format(round.years_off)}
              </td>
              <td>
                {round.distance_km === null
                  ? "—"
                  : number.format(round.distance_km)}
              </td>
              <td>{round.actual_year ?? "—"}</td>
              <td>
                {round.actual_location
                  ? `${number.format(round.actual_location.lat)}°, ${number.format(round.actual_location.lng)}°`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
