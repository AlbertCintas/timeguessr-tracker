import { useEffect, useId, useState, type ReactNode } from "react";
import { Flag, Hourglass, Info, Lightbulb, Map as MapIcon } from "lucide-react";
import type { Game, Result } from "./types";
import {
  featuredPictures,
  locationDensity,
  yearDistribution,
  type FeaturedPicture,
} from "./featuredPictures";
import {
  colorSteps,
  countryCounts,
  countryLastSeen,
  dated,
  decadeAccuracy,
  decades,
  located,
  pictureScores,
  stepLabel,
  stepOf,
} from "./atlasStats";
import { continentOf, flag } from "./countries";
import { europeanDate } from "./scoring";

const atlasTabs = {
  map: { label: "Map", icon: MapIcon },
  trivia: { label: "Trivia", icon: Lightbulb },
  countries: { label: "Countries", icon: Flag },
  years: { label: "Years", icon: Hourglass },
} as const;
type AtlasTab = keyof typeof atlasTabs;
const tabFromHash = (): AtlasTab =>
  location.hash.slice(1) in atlasTabs
    ? (location.hash.slice(1) as AtlasTab)
    : "map";

const x = (lng: number) => (lng + 180) * 2;
const y = (lat: number) => (90 - lat) * 2;
const whole = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const plural = (n: number, word: string) =>
  `${whole.format(n)} ${n === 1 ? word : word === "country" ? "countries" : `${word}s`}`;
const distance = (km: number) =>
  km < 1 ? `${whole.format(km * 1000)} m` : `${whole.format(km)} km`;
const list = new Intl.ListFormat("en", { type: "conjunction" });
const gameDate = (game: Game) =>
  game.kind === "daily" && game.daily_date
    ? game.daily_date
    : game.played_on || game.created_at.slice(0, 10);
const stepIndex = (i: number, steps: readonly number[]) =>
  steps.length === 1 ? 3 : Math.round((i * 3) / (steps.length - 1));
const stepFill = (i: number, steps: readonly number[]) =>
  `var(--step-${stepIndex(i, steps)})`;
const land = (
  <image
    href={`${import.meta.env.BASE_URL}world-land.svg`}
    width="720"
    height="360"
  />
);

function Heading({
  title,
  summary,
  controls,
}: {
  title: string;
  summary: string;
  controls: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>
      {controls}
    </div>
  );
}

function HeatMap({ pictures }: { pictures: FeaturedPicture[] }) {
  const points = located(pictures);
  const cells = locationDensity(points, 3);
  const steps = colorSteps(Math.max(1, ...cells.map((c) => c.count)));
  return (
    <section className="atlas-hero">
      <svg
        className="atlas-map"
        viewBox="0 0 720 360"
        role="img"
        aria-label={`Heat map of ${plural(points.length, "picture")} in 3° areas`}
      >
        {land}
        {cells.map((cell) => {
          const step = stepOf(cell.count, steps);
          return (
            <circle
              key={`${cell.lat}:${cell.lng}`}
              cx={x(cell.lng + 1.5)}
              cy={y(cell.lat + 1.5)}
              r={3 + stepIndex(step, steps) * 0.6}
              style={{ fill: stepFill(step, steps) }}
            >
              <title>{plural(cell.count, "picture")}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="map-legend" aria-label="Pictures per circle">
        {steps.map((_, i) => (
          <li key={i}>
            <i
              style={{
                background: stepFill(i, steps),
                width: 9 + stepIndex(i, steps) * 2,
                height: 9 + stepIndex(i, steps) * 2,
              }}
            />
            {stepLabel(steps, i)}
          </li>
        ))}
      </ul>
      <p className="map-note">
        {plural(points.length, "picture")} · each circle covers a 3° area
      </p>
    </section>
  );
}

function CountryList({
  pictures,
  games,
}: {
  pictures: FeaturedPicture[];
  games: Game[];
}) {
  const counts = countryCounts(pictures);
  const max = counts[0]?.count ?? 1;
  const lastSeen = countryLastSeen(pictures, (id) => {
    const game = games.find((g) => g.id === id);
    return game ? gameDate(game) : null;
  });
  const byContinent = new Map<string, number>();
  for (const { country, count } of counts) {
    const continent = continentOf(country) ?? "Elsewhere";
    byContinent.set(continent, (byContinent.get(continent) ?? 0) + count);
  }
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <section className="featured-card country-card">
      <ul className="continent-row" aria-label="Pictures per continent">
        {[...byContinent]
          .sort((a, b) => b[1] - a[1])
          .map(([continent, count]) => (
            <li key={continent}>
              <span>{continent}</span>
              <strong>{count}</strong>
              <small>{Math.round((count / total) * 100)}%</small>
            </li>
          ))}
      </ul>
      <ol className="country-list" aria-label="Pictures per country">
        {counts.map(({ country, count }) => (
          <li key={country}>
            <span className="country-rank">
              {counts.filter((c) => c.count > count).length + 1}
            </span>
            <span className="country-flag" aria-hidden>
              {flag(country)}
            </span>
            <span className="country-name">{country}</span>
            <span className="country-bar">
              <i style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <strong>{count}</strong>
            <span className="country-seen">
              {lastSeen.has(country) && europeanDate(lastSeen.get(country)!)}
            </span>
          </li>
        ))}
      </ol>
      <p className="map-note">Last column: when the country last appeared.</p>
    </section>
  );
}

function DecadeBars({
  pictures,
  results,
}: {
  pictures: FeaturedPicture[];
  results: Result[];
}) {
  const rows = decades(pictures);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const accuracy = decadeAccuracy(pictures, results);
  return (
    <section className="featured-card">
      <div
        className="decade-strip"
        role="list"
        aria-label="Pictures per decade"
      >
        {rows.map(({ decade, count }) => (
          <div
            key={decade}
            className="decade"
            role="listitem"
            aria-label={`${decade}s: ${plural(count, "picture")}`}
          >
            <span className="decade-count">{count}</span>
            <span className="decade-track">
              <i style={{ height: `${(count / max) * 100}%` }} />
            </span>
            <strong>{`’${String(decade).slice(2)}`}</strong>
            <span
              className="decade-error"
              title={
                accuracy.has(decade)
                  ? `The club guesses ${decade}s pictures ${accuracy.get(decade)!.toFixed(1)} years off on average`
                  : undefined
              }
            >
              {accuracy.has(decade)
                ? `±${Math.round(accuracy.get(decade)!)}`
                : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="map-note">
        ± under each decade: how many years off the club guesses on average.
      </p>
    </section>
  );
}

function YearChart({ pictures }: { pictures: FeaturedPicture[] }) {
  const years = yearDistribution(pictures);
  const first = years[0]!.year;
  const last = years.at(-1)!.year;
  const max = Math.max(...years.map((y) => y.count));
  const width = (last - first + 1) * 8;
  const ticks = [];
  for (let year = Math.ceil(first / 10) * 10; year <= last; year += 10)
    ticks.push(year);
  return (
    <section className="featured-card">
      <h3>Every year</h3>
      <div className="year-chart-scroll">
        <svg
          className="year-chart"
          viewBox={`0 0 ${width} 120`}
          role="img"
          aria-label={`Pictures per year from ${first} to ${last}`}
        >
          {years.map(({ year, count }) => {
            const height = (count / max) * 90;
            return (
              <rect
                key={year}
                x={(year - first) * 8 + 1}
                y={100 - height}
                width="6"
                height={height}
                rx="1.5"
              >
                <title>{`${year}: ${plural(count, "picture")}`}</title>
              </rect>
            );
          })}
          <line x1="0" x2={width} y1="100.5" y2="100.5" />
          {ticks.map((year) => (
            <text key={year} x={(year - first) * 8 + 4} y="116">
              {year}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function Caption({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="caption-tip">
      <button
        type="button"
        className="caption-button"
        aria-label="What the picture showed"
        aria-describedby={id}
      >
        <Info size={16} />
      </button>
      <span role="tooltip" id={id}>
        {text}
      </span>
    </span>
  );
}

function Fact({
  label,
  phrase,
  value,
  picture,
  detail,
}: {
  label: string;
  phrase: string;
  value: string;
  picture: FeaturedPicture;
  detail: string;
}) {
  return (
    <section className="trivia-fact">
      <div className="trivia-label">
        <h3>{label}</h3>
        {picture.description && <Caption text={picture.description} />}
      </div>
      <p className="trivia-phrase">{phrase}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
      {picture.location && (
        <svg
          className="mini-map"
          viewBox="0 0 720 360"
          role="img"
          aria-label={`Where the picture for “${label}” was taken`}
        >
          {land}
          <circle
            cx={x(picture.location.lng)}
            cy={y(picture.location.lat)}
            r="14"
          />
        </svg>
      )}
    </section>
  );
}

function Trivia({
  pictures,
  results,
  games,
}: {
  pictures: FeaturedPicture[];
  results: Result[];
  games: Game[];
}) {
  const gameLabel = (id: string) => {
    const game = games.find((g) => g.id === id);
    if (!game) return "a past game";
    return game.kind === "daily"
      ? `the ${europeanDate(gameDate(game))} daily`
      : `a replay game (${europeanDate(gameDate(game))})`;
  };
  const about = (p: FeaturedPicture) =>
    [p.year, p.country, gameLabel(p.gameId)].filter(Boolean).join(" · ");
  const averaged = (s: { players: number; picture: FeaturedPicture }) =>
    `Average of ${s.players} players · ${about(s.picture)}`;
  const oldest = dated(pictures).sort((a, b) => a.year - b.year)[0];
  const scores = pictureScores(pictures, results);
  const byPoints = [...scores].sort((a, b) => a.points - b.points);
  const placed = scores
    .filter((s) => s.kmOff !== null)
    .sort((a, b) => a.kmOff! - b.kmOff!);
  const misdated = scores
    .filter((s) => s.yearsOff !== null)
    .sort((a, b) => b.yearsOff! - a.yearsOff!)[0];
  const divisive = [...scores].sort((a, b) => b.spread - a.spread)[0];
  const called = [...scores].sort(
    (a, b) => b.exactYears - a.exactYears || b.players - a.players,
  )[0];
  const hardest = byPoints[0];
  const easiest = byPoints.at(-1);
  const best = placed[0];
  const worst = placed.at(-1);
  return (
    <div className="trivia-grid">
      {oldest && (
        <Fact
          label="Oldest picture"
          phrase="Sepia-tone champion"
          value={String(oldest.year)}
          picture={oldest}
          detail={[oldest.country, gameLabel(oldest.gameId)]
            .filter(Boolean)
            .join(" · ")}
        />
      )}
      {hardest && (
        <Fact
          label="Lowest average score"
          phrase="The picture that broke us"
          value={`${whole.format(hardest.points)} pts`}
          picture={hardest.picture}
          detail={averaged(hardest)}
        />
      )}
      {easiest && easiest !== hardest && (
        <Fact
          label="Highest average score"
          phrase="Free points"
          value={`${whole.format(easiest.points)} pts`}
          picture={easiest.picture}
          detail={averaged(easiest)}
        />
      )}
      {divisive && divisive.spread > 0 && (
        <Fact
          label="Biggest score gap"
          phrase="The great divide"
          value={`${whole.format(divisive.spread)} pts apart`}
          picture={divisive.picture}
          detail={`Best minus worst of ${divisive.players} players · ${about(divisive.picture)}`}
        />
      )}
      {misdated && (
        <Fact
          label="Biggest average year error"
          phrase="Wrong decade, every time"
          value={`${plural(Math.round(misdated.yearsOff!), "year")} off`}
          picture={misdated.picture}
          detail={averaged(misdated)}
        />
      )}
      {called && called.exactYears > 0 && (
        <Fact
          label="Most exact-year guesses"
          phrase="Called it"
          value={`${called.exactYears} of ${called.players} players`}
          picture={called.picture}
          detail={`Guessed the exact year · ${about(called.picture)}`}
        />
      )}
      {best && (
        <Fact
          label="Smallest average distance"
          phrase="Pinpointed"
          value={`${distance(best.kmOff!)} off`}
          picture={best.picture}
          detail={averaged(best)}
        />
      )}
      {worst && worst !== best && (
        <Fact
          label="Largest average distance"
          phrase="Where are we?"
          value={`${distance(worst.kmOff!)} off`}
          picture={worst.picture}
          detail={averaged(worst)}
        />
      )}
    </div>
  );
}

export function Atlas({
  games,
  results,
  controls,
}: {
  games: Game[];
  results: Result[];
  controls: ReactNode;
}) {
  const [tab, setTab] = useState<AtlasTab>(tabFromHash);
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  function openTab(next: AtlasTab) {
    setTab(next);
    history.replaceState(null, "", `${location.search}#${next}`);
  }
  const pictures = featuredPictures(results, games).filter(
    (p) => p.year !== null || p.location !== null || p.country !== null,
  );
  const countries = countryCounts(pictures);
  const busiest = [...decades(pictures)].sort((a, b) => b.count - a.count)[0];
  const years = yearDistribution(pictures);
  const top = Math.max(0, ...years.map((y) => y.count));
  const common = years
    .filter((y) => y.count === top)
    .map((y) => String(y.year));
  const commonYears =
    top < 2
      ? ""
      : common.length === 1
        ? ` Most common year: ${common[0]} (${top} pictures).`
        : ` Most common years: ${list.format(common.slice(0, 3))} (${top} each).`;
  const empty = (
    <p className="featured-empty">No pictures captured in this period yet.</p>
  );
  const panels: Record<AtlasTab, ReactNode> = {
    map: (
      <>
        <Heading
          title="Where in the world"
          summary="Every place Timeguessr has dragged us to."
          controls={controls}
        />
        {pictures.length ? <HeatMap pictures={pictures} /> : empty}
      </>
    ),
    countries: (
      <>
        <Heading
          title="Countries"
          summary={
            countries.length
              ? `${plural(countries.length, "country")} · ${countries.filter((c) => c.count === 1).length} seen only once.`
              : "Where the pictures were taken."
          }
          controls={controls}
        />
        {countries.length ? (
          <CountryList pictures={pictures} games={games} />
        ) : (
          empty
        )}
      </>
    ),
    years: (
      <>
        <Heading
          title="Years"
          summary={
            busiest
              ? `Favourite decade: the ${busiest.decade}s, ${busiest.count} of ${plural(dated(pictures).length, "picture")}.${commonYears}`
              : "When the pictures were taken."
          }
          controls={controls}
        />
        {busiest ? (
          <div className="years-panel">
            <DecadeBars pictures={pictures} results={results} />
            <YearChart pictures={pictures} />
          </div>
        ) : (
          empty
        )}
      </>
    ),
    trivia: (
      <>
        <Heading
          title="Trivia"
          summary="Pictures worth remembering, for better or worse."
          controls={controls}
        />
        {pictures.length ? (
          <Trivia pictures={pictures} results={results} games={games} />
        ) : (
          empty
        )}
      </>
    ),
  };
  return (
    <>
      <nav className="section-tabs" aria-label="Atlas sections">
        {(Object.keys(atlasTabs) as AtlasTab[]).map((key) => {
          const { label, icon: Icon } = atlasTabs[key];
          return (
            <button
              key={key}
              className="section-tab"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => openTab(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      {panels[tab]}
    </>
  );
}
