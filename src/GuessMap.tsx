import { land, x, y } from "./worldMap";
import type { CorrectAnswer, PictureResult } from "./types";

const whole = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const distance = (km: number) =>
  km < 1 ? `${whole.format(km * 1000)} m` : `${whole.format(km)} km`;
const copies = [-720, 0, 720];

/** A player's guess for one picture against the answer, on a world map. */
export function GuessMap({
  round,
  answer,
}: {
  round: PictureResult;
  answer?: CorrectAnswer | null;
}) {
  const guess = round.guess_location;
  const actual = answer?.actual_location ?? round.actual_location ?? null;
  const actualYear = answer?.actual_year ?? round.actual_year ?? null;
  const pins = guess
    ? [
        { x: x(guess.lng), y: y(guess.lat), kind: "guess" },
        ...(actual
          ? [
              {
                // Cross the antimeridian when that is the short way round.
                x:
                  x(actual.lng) +
                  (actual.lng - guess.lng > 180
                    ? -720
                    : guess.lng - actual.lng > 180
                      ? 720
                      : 0),
                y: y(actual.lat),
                kind: "answer",
              },
            ]
          : []),
      ]
    : [];
  return (
    <span className="guess-map">
      {pins.length > 0 && (
        <svg
          className="mini-map"
          viewBox="0 0 720 360"
          role="img"
          aria-label={
            actual ? "Map of the guess and the answer" : "Map of the guess"
          }
        >
          {copies.map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              {land}
              {pins.length === 2 && (
                <line
                  className="guess-line"
                  x1={pins[0]!.x}
                  y1={pins[0]!.y}
                  x2={pins[1]!.x}
                  y2={pins[1]!.y}
                />
              )}
              {[...pins].reverse().map((pin) => (
                <circle
                  key={pin.kind}
                  className={`${pin.kind}-pin`}
                  cx={pin.x}
                  cy={pin.y}
                  r="12"
                />
              ))}
            </g>
          ))}
        </svg>
      )}
      <span className="guess-facts">
        <span>
          <i className="guess-dot" /> Guess{" "}
          <strong>{round.guess_year ?? "—"}</strong>
        </span>
        <span>
          <i className="answer-dot" /> Answer{" "}
          <strong>{actualYear ?? "—"}</strong>
        </span>
        {round.distance_km !== null && (
          <span>{distance(round.distance_km)} off</span>
        )}
      </span>
    </span>
  );
}
