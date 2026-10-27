import type { CorrectAnswer } from "./types";
const coordinate = new Intl.NumberFormat("en", { maximumFractionDigits: 4 });

/** Show shared site answers even for games with no detailed player scores. */
export function CorrectAnswerBreakdown({
  answers,
  source,
}: {
  answers: readonly CorrectAnswer[];
  source: string | null;
}) {
  return (
    <details className="result-breakdown">
      <summary>Timeguessr’s correct answers</summary>
      <div className="picture-breakdown-scroll">
        <table className="picture-breakdown">
          <caption>Original photograph answers</caption>
          <thead>
            <tr>
              <th scope="col">Picture</th>
              <th scope="col">Correct year</th>
              <th scope="col">Correct location</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((answer, i) => (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td>{answer.actual_year ?? "—"}</td>
                <td>
                  {answer.actual_location
                    ? `${coordinate.format(answer.actual_location.lat)}°, ${coordinate.format(answer.actual_location.lng)}°`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {source &&
        /^https:\/\/timeguessr\.com\/(?:archive\?month=\d{4}-\d{2}|play\?mode=daily&archive=\d+-[a-f0-9]+|game-settings\?RA=[a-f0-9]{64}%3A[a-f0-9]{32})$/.test(
          source,
        ) && (
          <a href={source} target="_blank" rel="noopener noreferrer">
            Original Timeguessr game ↗
          </a>
        )}
    </details>
  );
}
