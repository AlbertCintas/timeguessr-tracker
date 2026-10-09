const prefixes = ["one", "two", "three", "four", "five"];
function replayId(gameId, playArray) {
  const candidate = String(gameId ?? "").includes(":")
    ? gameId
    : (playArray ?? []).slice(5, 7).join(":");
  return typeof candidate === "string" &&
    /^[a-f0-9]{64}:[a-f0-9]{32}$/i.test(candidate)
    ? candidate.toLowerCase()
    : null;
}
const number = (value) =>
  value === null || value === undefined || value === "" ? null : Number(value);
const integer = (value, max) =>
  Number.isInteger(value) && value >= 0 && value <= max;
const dateOnly = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const playedToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export function validateCapture(input) {
  if (!input || !["daily", "play", "custom"].includes(input.mode))
    throw new Error("Unsupported game type.");
  if (
    !integer(input.points, 50000) ||
    !Array.isArray(input.rounds) ||
    input.rounds.length !== 5
  )
    throw new Error("Waiting for all five pictures.");
  const rounds = input.rounds.map((r) => {
    if (
      !r ||
      !integer(r.points, 10000) ||
      (r.years_off !== null && !integer(r.years_off, 2147483647)) ||
      (r.distance_km !== null &&
        !(
          typeof r.distance_km === "number" &&
          Number.isFinite(r.distance_km) &&
          r.distance_km >= 0 &&
          r.distance_km <= 1e9
        ))
    )
      throw new Error("Invalid picture details.");
    return {
      points: r.points,
      years_off: r.years_off,
      distance_km: r.distance_km,
    };
  });
  if (rounds.reduce((sum, r) => sum + r.points, 0) !== input.points)
    throw new Error("The picture scores do not match the total.");
  if (!dateOnly(input.played_on)) throw new Error("Invalid played date.");
  const daily = input.mode === "daily";
  if (
    daily &&
    (!integer(input.daily_number, 1000000) || input.daily_number < 1)
  )
    throw new Error("Missing daily challenge number.");
  const source =
    typeof input.source_id === "string" && input.source_id.length <= 250
      ? input.source_id
      : null;
  const images = Array.isArray(input.images) ? input.images.slice(0, 5) : [];
  if (
    !daily &&
    !source &&
    (images.length !== 5 ||
      images.some((id) => typeof id !== "string" || !id || id.length > 2000))
  )
    throw new Error("Cannot identify this game safely.");
  const timer = input.timer_seconds ?? 0;
  if (!integer(timer, 86400)) throw new Error("Unknown timer settings.");
  const replay = input.replay_id ?? null;
  if (replay !== null && (daily || !/^[a-f0-9]{64}:[a-f0-9]{32}$/.test(replay)))
    throw new Error("Invalid replay identity.");
  return {
    mode: input.mode,
    points: input.points,
    rounds,
    daily_number: daily ? input.daily_number : null,
    played_on: input.played_on,
    source_id: source,
    images,
    timer_seconds: timer,
    replay_id: replay,
  };
}

export function captureModern(data, href, playedOn = playedToday()) {
  const url = new URL(href);
  if (!url.pathname.endsWith("/final-score") || !data) return null;
  if (
    url.searchParams.has("game_id") &&
    url.searchParams.get("game_id") !== data.gameId
  )
    return null;
  if (
    url.searchParams.has("mode") &&
    url.searchParams.get("mode") !== data.mode
  )
    return null;
  if ((url.searchParams.get("archive") || null) !== (data.archive || null))
    return null;
  if (!Array.isArray(data.roundResults) || data.roundResults.length !== 5)
    return null;
  if (
    data.mode === "daily" &&
    data.playArray?.[0]?.No != null &&
    number(data.playArray[0].No) !== number(data.dailyNumber)
  )
    return null;
  const rounds = data.roundResults.map((r) => ({
    points: number(r.totalScore),
    years_off:
      !r.noGuess &&
      number(r.guessYear) !== null &&
      number(r.actualYear) !== null
        ? Math.abs(number(r.guessYear) - number(r.actualYear))
        : null,
    distance_km:
      !r.noGuess && number(r.distanceMeters) !== null
        ? number(r.distanceMeters) / 1000
        : null,
  }));
  const images = (data.playArray ?? [])
    .slice(0, 5)
    .map((image) =>
      String(image?.ImageId ?? image?.ShareImageId ?? image?.URL ?? ""),
    );
  const source =
    data.mode === "custom" || String(data.gameId ?? "").includes(":")
      ? data.gameId
      : null;
  return validateCapture({
    mode: data.mode,
    points: number(data.score),
    rounds,
    daily_number: number(data.dailyNumber),
    played_on: playedOn,
    source_id: source,
    images,
    timer_seconds: number(data.timerSeconds) ?? 0,
    replay_id:
      data.mode === "daily" ? null : replayId(data.gameId, data.playArray),
  });
}

export function captureLegacy(
  values,
  href,
  visibleTotal,
  playedOn = playedToday(),
) {
  const path = new URL(href).pathname;
  const daily = path.endsWith("/finalscoredaily");
  if (!daily && !path.endsWith("/finalscore")) return null;
  const rounds = prefixes.map((prefix) => {
    const raw = number(values[`${prefix}DistanceMeters`]);
    const formatted = /^([\d,.]+)\s*(km|m)$/i.exec(
      values[`${prefix}Distance`] ?? "",
    );
    const distance =
      raw !== null
        ? raw / 1000
        : formatted
          ? Number(formatted[1].replaceAll(",", "")) /
            (formatted[2].toLowerCase() === "m" ? 1000 : 1)
          : null;
    return {
      points: number(values[`${prefix}Total`]),
      years_off: number(values[`${prefix}Year`] ?? values[`${prefix}YearsOff`]),
      distance_km: distance,
    };
  });
  if (rounds.some((r) => r.points === null)) return null;
  const points = rounds.reduce((sum, r) => sum + r.points, 0);
  if (
    number(
      String(visibleTotal ?? "")
        .replaceAll(",", "")
        .trim(),
    ) !== points
  )
    return null;
  let images;
  try {
    images = JSON.parse(values[daily ? "dailyArray" : "playArray"] ?? "[]")
      .slice(0, 5)
      .map((image) =>
        String(image?.ImageId ?? image?.ShareImageId ?? image?.URL ?? ""),
      );
  } catch {
    return null;
  }
  const dailyNumber = number(values.dailyNumber);
  if (
    daily &&
    images.length &&
    number(JSON.parse(values.dailyArray)[0]?.No) !== dailyNumber
  )
    return null;
  return validateCapture({
    mode: daily ? "daily" : "play",
    points,
    rounds,
    daily_number: dailyNumber,
    played_on: playedOn,
    source_id: null,
    images,
    timer_seconds: number(values.timerSetting) ?? 0,
    replay_id: daily
      ? null
      : replayId(null, JSON.parse(values.playArray ?? "[]")),
  });
}

export const legacyKeys = [
  "dailyArray",
  "playArray",
  "dailyNumber",
  "timerSetting",
  ...prefixes.flatMap((prefix) =>
    ["Total", "Year", "YearsOff", "Distance", "DistanceMeters"].map(
      (suffix) => prefix + suffix,
    ),
  ),
];

export function dailyDate(dailyNumber, html, now = Date.now()) {
  const current = Number(/dailyNumber\s*:\s*(\d+)/.exec(html)?.[1]);
  const ends = Number(/countdownEndsAt\s*:\s*(\d+)/.exec(html)?.[1]);
  if (
    !integer(current, 1000000) ||
    !current ||
    !Number.isFinite(ends) ||
    ends <= now ||
    ends > now + 86400000 + 60000 ||
    dailyNumber > current
  )
    throw new Error(
      "Could not verify the daily date. Review it in the extension.",
    );
  const currentDate = new Date(ends - 86400000).toISOString().slice(0, 10);
  const resolved = new Date(
    Date.parse(`${currentDate}T12:00:00Z`) - (current - dailyNumber) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const anchor = new Date(
    Date.UTC(2026, 9, 9) + (dailyNumber - 1227) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  if (resolved !== anchor)
    throw new Error(
      "Timeguessr’s calendar changed. Review the challenge date in the extension.",
    );
  return resolved;
}

export async function externalKey(capture) {
  if (capture.mode === "daily") return null;
  const identity = JSON.stringify([
    capture.mode,
    capture.source_id || capture.images,
    capture.timer_seconds,
  ]);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return `timeguessr:v1:${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
