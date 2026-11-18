import { ArrowUpRight, Lock, MapPin } from "lucide-react";
import { Tip } from "./Caption";
import { GuessMap } from "./GuessMap";
import type { CorrectAnswer, PictureResult } from "./types";
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
/** Scores and guess errors per round. The guess column shows the answer and `locked` hides every value, so callers gate both. */
export function PictureBreakdown({
  rounds,
  answers,
  showGuesses = false,
  locked = false,
  playUrl,
}: {
  rounds: PictureResult[];
  answers?: readonly CorrectAnswer[] | null;
  showGuesses?: boolean;
  locked?: boolean;
  playUrl?: string | null;
}) {
  if (locked)
    return (
      <div className="picture-breakdown-scroll locked-breakdown">
        <table className="picture-breakdown" aria-hidden="true">
          <thead>
            <tr>
              <th scope="col">Picture</th>
              <th scope="col">Points</th>
              <th scope="col">Years off</th>
              <th scope="col">Km off</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((_, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                {[0, 1, 2].map((cell) => (
                  <td key={cell}>
                    <span className="redacted" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="locked-overlay">
          <Lock size={18} />
          <span>Play to unlock</span>
          {playUrl && (
            <a
              className="game-play-link"
              href={playUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Play game <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </div>
    );
  const guesses =
    showGuesses &&
    rounds.some((round) => round.guess_location || round.guess_year);
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
            {guesses && (
              <th scope="col" className="caption-column" aria-label="Guess" />
            )}
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
              {guesses && (
                <td className="caption-column">
                  {round.guess_location || round.guess_year ? (
                    <Tip
                      label={`Guess for picture ${index + 1}`}
                      icon={<MapPin size={16} />}
                      className="guess-tip"
                    >
                      <GuessMap round={round} answer={answers?.[index]} />
                    </Tip>
                  ) : (
                    "—"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
