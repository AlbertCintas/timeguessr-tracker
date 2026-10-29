import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  CircleDot,
  Flag,
  Flame,
  Hexagon,
  Hourglass,
  Info,
  Lightbulb,
  Map as MapIcon,
  Maximize,
  Minus,
  Plus,
  Thermometer,
} from "lucide-react";
import type { Game, Result } from "./types";
import {
  cellOf,
  featuredPictures,
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
  hexBins,
  located,
  pictureScores,
  type Located,
  stepLabel,
  stepOf,
} from "./atlasStats";
import { continentOf, countryCode, flag } from "./countries";
import { loadPlaces, placeName, type Places } from "./places";
import { answersRevealed, europeanDate } from "./scoring";

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

type View = { x: number; y: number; zoom: number };
const fullView: View = { x: 0, y: 0, zoom: 1 };
const maxZoom = 16;

function clampView({ x, y, zoom }: View): View {
  const z = Math.min(maxZoom, Math.max(1, zoom));
  return {
    zoom: z,
    x: Math.min(720 - 720 / z, Math.max(0, x)),
    y: Math.min(360 - 360 / z, Math.max(0, y)),
  };
}

/** Zooms by `factor` while keeping the map point (px, py) still. */
const zoomAt = (view: View, factor: number, px: number, py: number) => {
  const zoom = Math.min(maxZoom, Math.max(1, view.zoom * factor));
  const keep = view.zoom / zoom;
  return clampView({
    zoom,
    x: px - (px - view.x) * keep,
    y: py - (py - view.y) * keep,
  });
};

const cellSize = (zoom: number) => (zoom < 3 ? 3 : zoom < 8 ? 1 : 0.25);

function useMapZoom() {
  const [view, setView] = useState(fullView);
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const toMap = (clientX: number, clientY: number, from: View) => {
    const box = svg.current!.getBoundingClientRect();
    return {
      x: from.x + ((clientX - box.left) / box.width) * (720 / from.zoom),
      y: from.y + ((clientY - box.top) / box.height) * (360 / from.zoom),
    };
  };
  const zoomAround = (factor: number, clientX: number, clientY: number) =>
    setView((v) => {
      const at = toMap(clientX, clientY, v);
      return zoomAt(v, factor, at.x, at.y);
    });
  const zoomedIn = view.zoom > 1;
  useEffect(() => {
    const node = svg.current!;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY > 0 && !zoomedIn) return;
      event.preventDefault();
      zoomAround(Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [zoomedIn]);
  const release = (event: PointerEvent<SVGSVGElement>) =>
    pointers.current.delete(event.pointerId);
  const handlers = {
    onPointerDown(event: PointerEvent<SVGSVGElement>) {
      const at = { x: event.clientX, y: event.clientY };
      if (!pointers.current.size) {
        start.current = at;
        dragged.current = false;
      }
      pointers.current.set(event.pointerId, at);
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      const before = pointers.current.get(event.pointerId);
      if (!before) return;
      const after = { x: event.clientX, y: event.clientY };
      if (!dragged.current) {
        if (
          pointers.current.size < 2 &&
          Math.hypot(after.x - start.current.x, after.y - start.current.y) < 5
        )
          return;
        dragged.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const others = [...pointers.current.entries()].filter(
        ([id]) => id !== event.pointerId,
      );
      pointers.current.set(event.pointerId, after);
      if (others.length === 1) {
        const other = others[0]![1];
        zoomAround(
          Math.hypot(after.x - other.x, after.y - other.y) /
            Math.max(1, Math.hypot(before.x - other.x, before.y - other.y)),
          (after.x + other.x) / 2,
          (after.y + other.y) / 2,
        );
      } else if (!others.length)
        setView((v) => {
          const from = toMap(before.x, before.y, v);
          const to = toMap(after.x, after.y, v);
          return clampView({
            ...v,
            x: v.x + from.x - to.x,
            y: v.y + from.y - to.y,
          });
        });
    },
    onPointerUp: release,
    onPointerCancel: release,
    onDoubleClick(event: MouseEvent<SVGSVGElement>) {
      zoomAround(2, event.clientX, event.clientY);
    },
  };
  const zoomBy = (factor: number) =>
    setView((v) => zoomAt(v, factor, v.x + 360 / v.zoom, v.y + 180 / v.zoom));
  return {
    view,
    svg,
    handlers,
    dragged,
    zoomBy,
    toMap,
    reset: () => setView(fullView),
  };
}

function PlaceTip({
  pictures,
  left,
  top,
}: {
  pictures: Located[];
  left: number;
  top: number;
}) {
  const [places, setPlaces] = useState<Places | "failed" | null>(null);
  useEffect(() => {
    loadPlaces().then(setPlaces, () => setPlaces("failed"));
  }, []);
  const groups = new Map<string, { label: string; count: number }>();
  for (const { location, country } of pictures) {
    const code = country && countryCode(country);
    const name =
      places && places !== "failed"
        ? placeName(places, location.lat, location.lng, code)
        : null;
    const label = [flag(country ?? ""), name ?? country ?? "Unknown country"]
      .filter(Boolean)
      .join(" ");
    const group = groups.get(label) ?? { label, count: 0 };
    group.count++;
    groups.set(label, group);
  }
  return (
    <div
      className="map-tip"
      role="dialog"
      aria-label="Places in this area"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-${left}%, ${top > 45 ? "calc(-100% - 12px)" : "12px"})`,
      }}
    >
      <strong>{plural(pictures.length, "picture")}</strong>
      {places === null && <p>Finding places…</p>}
      <ul>
        {[...groups.values()]
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .map(({ label, count }) => (
            <li key={label}>
              <span>{label}</span>
              {count > 1 && <small>×{count}</small>}
            </li>
          ))}
      </ul>
    </div>
  );
}

type MapMode = "dots" | "heat";
type HeatStyle = "hexagons" | "thermal";
function stored<T extends string>(key: string, values: readonly T[]): T {
  try {
    const value = localStorage.getItem(key);
    return values.includes(value as T) ? (value as T) : values[0]!;
  } catch {
    return values[0]!;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
type Bin = { key: string; x: number; y: number; pictures: Located[] };
const at = (p: Located) => ({ x: x(p.location.lng), y: y(p.location.lat) });

function cellBins(points: Located[], size: number) {
  const bins = new Map<string, Bin>();
  for (const p of points) {
    const cell = cellOf(p.location, size);
    const key = `${size}:${cell.lat}:${cell.lng}`;
    const bin = bins.get(key) ?? {
      key,
      x: x(cell.lng + size / 2),
      y: y(cell.lat + size / 2),
      pictures: [],
    };
    bin.pictures.push(p);
    bins.set(key, bin);
  }
  return [...bins.values()];
}

const hexPath = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${i ? "L" : "M"}${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)}`;
  }).join("") + "Z";

function useWidth(ref: RefObject<Element | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width),
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return width;
}

const thermalStops: [number, string][] = [
  [0, "#2b4fd8"],
  [0.2, "#1fa9e8"],
  [0.4, "#2fd08a"],
  [0.6, "#e6e23a"],
  [0.8, "#f7931e"],
  [1, "#e0311d"],
];
const thermalCss = `linear-gradient(90deg, ${thermalStops.map(([at, c]) => `${c} ${at * 100}%`).join(", ")})`;
/** Spread of each picture's warmth, in map units (2 per degree). */
const spread = 6;

let landMask: Promise<HTMLImageElement> | null = null;
const loadLandMask = () =>
  (landMask ??= fetch(`${import.meta.env.BASE_URL}world-land.svg`)
    .then((response) => response.text())
    .then(
      (svg) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/fill-opacity="[^"]*"/g, ""))}`;
        }),
    ));

const reach = spread * 3;
const edge = Math.exp(-4.5);
/** A Gaussian lowered to reach exactly zero at `reach`, so no seam shows. */
const warmth = (dx: number, dy: number) =>
  Math.max(
    0,
    (Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread)) - edge) /
      (1 - edge),
  );

/**
 * Sums a Gaussian of warmth per picture on a coarse grid, scales it so the
 * warmest picture is red at any zoom, and clips the smoothed result to land.
 */
function ThermalLayer({
  points,
  view,
  width,
}: {
  points: Located[];
  view: View;
  width: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mask, setMask] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    loadLandMask().then(setMask, () => {});
  }, []);
  useEffect(() => {
    const node = canvas.current!;
    const ratio = Math.min(2, devicePixelRatio);
    const w = Math.round(width * ratio);
    const h = Math.round((width / 2) * ratio);
    if (!w) return;
    node.width = w;
    node.height = h;
    const coords = points.map(at);
    const peak = Math.max(
      1,
      ...coords.map((p) =>
        coords.reduce((sum, q) => sum + warmth(p.x - q.x, p.y - q.y), 0),
      ),
    );
    const columns = Math.ceil(width / 5);
    const rows = Math.ceil(columns / 2);
    const cell = 720 / view.zoom / columns;
    const field = new Float32Array(columns * rows);
    for (const p of coords) {
      const left = Math.max(0, Math.floor((p.x - reach - view.x) / cell));
      const right = Math.min(
        columns - 1,
        Math.ceil((p.x + reach - view.x) / cell),
      );
      const top = Math.max(0, Math.floor((p.y - reach - view.y) / cell));
      const bottom = Math.min(
        rows - 1,
        Math.ceil((p.y + reach - view.y) / cell),
      );
      for (let row = top; row <= bottom; row++)
        for (let column = left; column <= right; column++)
          field[row * columns + column]! += warmth(
            view.x + (column + 0.5) * cell - p.x,
            view.y + (row + 0.5) * cell - p.y,
          );
    }
    const ramp = document.createElement("canvas");
    ramp.width = 256;
    ramp.height = 1;
    const rampContext = ramp.getContext("2d")!;
    const gradient = rampContext.createLinearGradient(0, 0, 256, 0);
    for (const [offset, stop] of thermalStops)
      gradient.addColorStop(offset, stop);
    rampContext.fillStyle = gradient;
    rampContext.fillRect(0, 0, 256, 1);
    const palette = rampContext.getImageData(0, 0, 256, 1).data;
    const grid = document.createElement("canvas");
    grid.width = columns;
    grid.height = rows;
    const gridContext = grid.getContext("2d")!;
    const image = gridContext.createImageData(columns, rows);
    field.forEach((value, i) => {
      const level = Math.round(Math.min(1, value / peak) ** 0.6 * 255);
      image.data.set(palette.subarray(level * 4, level * 4 + 3), i * 4);
      image.data[i * 4 + 3] = 255;
    });
    gridContext.putImageData(image, 0, 0);
    const context = node.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(grid, 0, 0, w, h);
    if (!mask) return;
    const scale = w / (720 / view.zoom);
    context.globalCompositeOperation = "destination-in";
    context.filter = `blur(${ratio}px)`;
    context.drawImage(
      mask,
      -view.x * scale,
      -view.y * scale,
      720 * scale,
      360 * scale,
    );
  });
  return <canvas ref={canvas} className="map-thermal" aria-hidden />;
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="map-mode" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function HeatMap({ pictures }: { pictures: FeaturedPicture[] }) {
  const { view, svg, handlers, dragged, zoomBy, reset, toMap } = useMapZoom();
  const [mode, setMode] = useState(() =>
    stored<MapMode>("atlasMap", ["dots", "heat"]),
  );
  const [heatStyle, setHeatStyle] = useState(() =>
    stored<HeatStyle>("atlasHeat", ["hexagons", "thermal"]),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);
  const width = useWidth(svg);
  const style = mode === "dots" ? "dots" : heatStyle;
  const thermal = style === "thermal";
  const size = cellSize(view.zoom) * (style === "hexagons" ? 2 : 1);
  const points = located(pictures);
  const hexRadius = (size * 2) / Math.sqrt(3);
  const bins: Bin[] =
    style === "hexagons"
      ? hexBins(points, at, hexRadius).map((bin) => ({
          key: `${size}:hex:${bin.key}`,
          x: bin.x,
          y: bin.y,
          pictures: bin.items,
        }))
      : thermal
        ? []
        : cellBins(points, size);
  bins.sort((a, b) => b.pictures.length - a.pictures.length);
  const steps = colorSteps(Math.max(1, ...bins.map((b) => b.pictures.length)));
  const fill = (count: number) => stepFill(stepOf(count, steps), steps);
  const shrink = Math.min(1, (size * 2 * view.zoom) / 6) / view.zoom;
  const reach = spread * 1.5;
  const nearby =
    probe &&
    points.filter(
      (p) => Math.hypot(at(p).x - probe.x, at(p).y - probe.y) <= reach,
    );
  const open: Bin | undefined = thermal
    ? nearby?.length
      ? { key: `${probe!.x}:${probe!.y}`, ...probe!, pictures: nearby }
      : undefined
    : bins.find((bin) => bin.key === selected);
  const toggle = (key: string) => {
    if (!dragged.current)
      setSelected((current) => (current === key ? null : key));
  };
  const close = () => {
    setSelected(null);
    setProbe(null);
  };
  const shape = style === "hexagons" ? "hexagon" : "circle";
  const binProps = (bin: Bin) => ({
    className: "map-bin",
    style: { fill: fill(bin.pictures.length) },
    role: "button",
    tabIndex: 0,
    "aria-label": `${plural(bin.pictures.length, "picture")}: show places`,
    "aria-expanded": bin.key === selected,
    onClick: () => toggle(bin.key),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      dragged.current = false;
      toggle(bin.key);
    },
  });
  const tipLeft = open && ((open.x - view.x) * view.zoom) / 7.2;
  const tipTop = open && ((open.y - view.y) * view.zoom) / 3.6;
  return (
    <section className="atlas-hero">
      <div
        className="atlas-map-frame"
        onKeyDown={(event) => event.key === "Escape" && close()}
      >
        <svg
          ref={svg}
          className="atlas-map"
          data-zoomed={view.zoom > 1 || undefined}
          viewBox={`${view.x} ${view.y} ${720 / view.zoom} ${360 / view.zoom}`}
          role="group"
          aria-label={
            thermal
              ? `Thermal map of ${plural(points.length, "picture")}`
              : `${style === "dots" ? "Map" : "Heat map"} of ${plural(points.length, "picture")} in ${size}° areas`
          }
          onClick={(event) => {
            if (
              dragged.current ||
              (event.target as Element).closest(".map-bin")
            )
              return;
            setSelected(null);
            setProbe(
              thermal ? toMap(event.clientX, event.clientY, view) : null,
            );
          }}
          {...handlers}
        >
          {land}
          {bins.map((bin) =>
            style === "hexagons" ? (
              <path
                key={bin.key}
                d={hexPath(bin.x, bin.y, hexRadius)}
                {...binProps(bin)}
              />
            ) : (
              <circle
                key={bin.key}
                cx={bin.x}
                cy={bin.y}
                r={
                  (3 +
                    stepIndex(stepOf(bin.pictures.length, steps), steps) *
                      0.6) *
                  shrink
                }
                {...binProps(bin)}
              />
            ),
          )}
        </svg>
        {thermal && <ThermalLayer points={points} view={view} width={width} />}
        {thermal && open && (
          <svg
            className="map-probe"
            viewBox={`${view.x} ${view.y} ${720 / view.zoom} ${360 / view.zoom}`}
            aria-hidden
          >
            <circle cx={open.x} cy={open.y} r={reach} />
          </svg>
        )}
        {open &&
          tipLeft! >= 0 &&
          tipLeft! <= 100 &&
          tipTop! >= 0 &&
          tipTop! <= 100 && (
            <PlaceTip
              key={open.key}
              pictures={open.pictures}
              left={tipLeft!}
              top={tipTop!}
            />
          )}
        <div className="map-zoom" role="group" aria-label="Map zoom">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={view.zoom >= maxZoom}
            onClick={() => zoomBy(2)}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={view.zoom <= 1}
            onClick={() => zoomBy(0.5)}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            aria-label="Show the whole world"
            disabled={view.zoom <= 1}
            onClick={reset}
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
      <div className="map-footer">
        <Choice
          label="Map style"
          value={mode}
          options={[
            { value: "dots", label: "Dots", icon: <CircleDot size={15} /> },
            { value: "heat", label: "Heat", icon: <Flame size={15} /> },
          ]}
          onChange={(next) => {
            setMode(next);
            close();
            store("atlasMap", next);
          }}
        />
        {mode === "heat" && (
          <Choice
            label="Heat style"
            value={heatStyle}
            options={[
              {
                value: "hexagons",
                label: "Hexagons",
                icon: <Hexagon size={15} />,
              },
              {
                value: "thermal",
                label: "Thermal",
                icon: <Thermometer size={15} />,
              },
            ]}
            onChange={(next) => {
              setHeatStyle(next);
              close();
              store("atlasHeat", next);
            }}
          />
        )}
        {thermal ? (
          <div
            className="thermal-legend"
            role="group"
            aria-label="Picture density"
          >
            <span>Fewer</span>
            <i style={{ background: thermalCss }} />
            <span>More pictures</span>
          </div>
        ) : (
          <ul
            className="map-legend"
            data-shape={shape}
            aria-label={`Pictures per ${shape}`}
          >
            {steps.map((_, i) => (
              <li key={i}>
                <i
                  style={{
                    background: stepFill(i, steps),
                    width: style === "dots" ? 9 + stepIndex(i, steps) * 2 : 12,
                    height: style === "dots" ? 9 + stepIndex(i, steps) * 2 : 12,
                  }}
                />
                {stepLabel(steps, i)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="map-note">
        {plural(points.length, "picture")} ·{" "}
        {thermal
          ? "warmer colours mean more pictures nearby"
          : style === "hexagons"
            ? `each hexagon is about ${size}° wide`
            : `each circle covers a ${size}° area`}{" "}
        · scroll, pinch or double-click to zoom, drag to move, click{" "}
        {thermal ? "a hot spot" : `a ${shape}`} for its places
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
            data-top={count === max || undefined}
            role="listitem"
            aria-label={`${decade}s: ${plural(count, "picture")}${count === max ? " · favourite decade" : ""}`}
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
        Gold: the favourite decade. ± under each decade: how many years off the
        club guesses on average.
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
            const height = (count / max) * 78;
            const top = count === max && max > 1;
            return (
              <g key={year} className={top ? "year-top" : undefined}>
                <rect
                  x={(year - first) * 8 + 1}
                  y={100 - height}
                  width="6"
                  height={height}
                  rx="1.5"
                >
                  <title>{`${year}: ${plural(count, "picture")}`}</title>
                </rect>
                {top && (
                  <text x={(year - first) * 8 + 4} y={95 - height}>
                    {year}
                  </text>
                )}
              </g>
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
      {max > 1 && (
        <p className="map-note">
          {years.filter((y) => y.count === max).length === 1
            ? `Gold: the most common year (${max} pictures).`
            : `Gold: the most common years (${max} pictures each).`}
        </p>
      )}
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
  games: allGames,
  results: allResults,
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
  const games = allGames.filter((game) => answersRevealed(game));
  const shown = new Set(games.map((game) => game.id));
  const results = allResults.filter((result) => shown.has(result.game_id));
  const pictures = featuredPictures(results, games).filter(
    (p) => p.year !== null || p.location !== null || p.country !== null,
  );
  const countries = countryCounts(pictures);
  const busiest = [...decades(pictures)].sort((a, b) => b.count - a.count)[0];
  const withCountry = countries.reduce((sum, c) => sum + c.count, 0);
  const withYear = dated(pictures).length;
  const scored = pictureScores(pictures, results).length;
  const empty = (
    <p className="featured-empty">
      No pictures revealed in this period yet. Daily games appear the next day;
      other games a week after the first play.
    </p>
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
              ? `${plural(countries.length, "country")} · ${countries.filter((c) => c.count === 1).length} seen only once. Based on ${plural(withCountry, "picture")} with a known country.`
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
              ? `Based on ${plural(withYear, "picture")} with a known year.`
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
          summary={
            pictures.length
              ? `Based on ${plural(pictures.length, "picture")}.${scored < pictures.length ? ` Average cards use the ${scored} that two or more players shared details for.` : ""}`
              : "Pictures worth remembering, for better or worse."
          }
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
