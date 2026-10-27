import type { ReactNode } from "react";
import type { Game, Result } from "./types";
import {
  featuredPictures,
  locationDensity,
  yearDistribution,
} from "./featuredPictures";

/** Club-wide answer geography and year frequency, counting each game round once. */
export function FeaturedPictureCharts({
  results,
  controls,
  games,
}: {
  results: Result[];
  games: Game[];
  controls: ReactNode;
}) {
  const pictures = featuredPictures(results, games);
  const years = yearDistribution(pictures);
  const cells = locationDensity(pictures);
  const located = pictures.filter((p) => p.location !== null).length;
  const dated = pictures.filter((p) => p.year !== null).length;
  const maxDensity = Math.max(1, ...cells.map((c) => c.count));
  const maxYears = Math.max(1, ...years.map((y) => y.count));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Featured pictures</h2>
          <p>The places and years Timeguessr keeps coming back to.</p>
        </div>
        {controls}
      </div>
      <p className="featured-coverage">
        {located} mapped · {dated} dated · {pictures.length} pictures. Each
        picture counts once per game across all players.
      </p>
      <div className="featured-charts">
        <section className="featured-card">
          <h3>Where in the world?</h3>
          <p>Location heatmap · pictures per 5° cell</p>
          {located ? (
            <>
              <svg
                className="featured-map"
                viewBox="0 0 720 360"
                role="img"
                aria-label={`Location heatmap of ${located} featured pictures`}
              >
                <image
                  href={`${import.meta.env.BASE_URL}world-land.svg`}
                  width="720"
                  height="360"
                />
                {[0, 60, 120, 180, 240, 300, 360].map((y) => (
                  <line key={`y${y}`} x1="0" x2="720" y1={y} y2={y} />
                ))}
                {[0, 120, 240, 360, 480, 600, 720].map((x) => (
                  <line key={`x${x}`} y1="0" y2="360" x1={x} x2={x} />
                ))}
                {cells.map((cell) => (
                  <rect
                    key={`${cell.lat}:${cell.lng}`}
                    x={(cell.lng + 180) * 2}
                    y={(85 - cell.lat) * 2}
                    width="10"
                    height="10"
                    fill="currentColor"
                    fillOpacity={0.25 + (0.75 * cell.count) / maxDensity}
                  >
                    <title>
                      {cell.lat}° to {cell.lat + 5}° latitude, {cell.lng}° to{" "}
                      {cell.lng + 5}° longitude: {cell.count} pictures
                    </title>
                  </rect>
                ))}
              </svg>
              <div className="heat-legend">
                <span>Fewer</span>
                <i />
                <span>More · max {maxDensity}</span>
              </div>
              <details>
                <summary>Location counts</summary>
                <div className="density-table">
                  <table>
                    <caption>Featured locations by geographic cell</caption>
                    <thead>
                      <tr>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Pictures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cells.map((c) => (
                        <tr key={`${c.lat}:${c.lng}`}>
                          <td>
                            {c.lat}° to {c.lat + 5}°
                          </td>
                          <td>
                            {c.lng}° to {c.lng + 5}°
                          </td>
                          <td>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="featured-empty">
              No correct locations captured in this period yet.
            </p>
          )}
        </section>
        <section className="featured-card">
          <h3>When was that again?</h3>
          <p>Year distribution · exact answer years</p>
          {dated ? (
            <div
              className="year-chart"
              role="list"
              aria-label="Featured year distribution"
            >
              {years.map(({ year, count }) => (
                <div
                  className="year-column"
                  role="listitem"
                  aria-label={`${year}: ${count} pictures`}
                  key={year}
                >
                  <span>{count}</span>
                  <div className="year-track">
                    <i style={{ height: `${(count / maxYears) * 100}%` }} />
                  </div>
                  <strong>{year}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="featured-empty">
              No correct years captured in this period yet.
            </p>
          )}
        </section>
      </div>
      <p className="featured-coverage">
        Answers are the original photograph years and locations from Timeguessr,
        never player guesses. Extension v1.2.0 automatically backfills saved
        games from the daily archive and replay links while auto-import is
        enabled. Games without a recoverable source remain missing.
      </p>
    </>
  );
}
