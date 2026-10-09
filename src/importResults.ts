import type { PictureResult } from "./types.ts";

export interface ImportedResult {
  points: number;
  dailyNumber: number | null;
  rounds: PictureResult[] | null;
}
const numeric = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const valueOf = (value: string) => Number(value.replaceAll(",", ""));

export function parseTimeguessrResults(text: string): ImportedResult {
  if (text.length > 10000)
    throw new Error("That paste is too long. Copy just the shared results.");
  const normalized = text
    .replaceAll("\uFE0F", "")
    .replaceAll("\u20E3", "")
    .replaceAll("\r", "");
  const header = normalized.match(
    new RegExp(
      String.raw`^\s*TimeGuessr\s*(?:#\s*(\d+))?\s*(?:[—–-]\s*)?(${numeric})\s*\/\s*50,?000\s*$`,
      "im",
    ),
  );
  if (!header)
    throw new Error(
      "Couldn’t find a Timeguessr score. Copy the text from Share results, then paste it here.",
    );
  const points = valueOf(header[2]);
  const dailyNumber = header[1] ? Number(header[1]) : null;
  if (
    !Number.isInteger(points) ||
    points < 0 ||
    points > 50000 ||
    (dailyNumber !== null &&
      (!Number.isInteger(dailyNumber) ||
        dailyNumber < 1 ||
        dailyNumber > 1000000))
  )
    throw new Error("The shared total or challenge number is invalid.");
  const detailLines = normalized
    .split("\n")
    .filter((line) => /🏆|📅\s*[-\d]/u.test(line));
  if (!detailLines.length) return { points, dailyNumber, rounds: null };
  if (detailLines.length !== 5)
    throw new Error(
      "Detailed results need all five picture lines. Copy the complete Detailed share text.",
    );
  const pattern = new RegExp(
    String.raw`^\s*([1-5])[.)]?\s*🏆\s*(${numeric})\s*[·—–-]\s*📅\s*(-|[+-]?\d+\s*y(?:ears?)?)\s*[·—–-]\s*[🌍🌎🌏]\s*(-|${numeric}\s*(?:km|mi|m))\s*$`,
    "iu",
  );
  const rounds = detailLines.map((line, index) => {
    const match = line.match(pattern);
    if (!match || Number(match[1]) !== index + 1)
      throw new Error(
        "Couldn’t read the five picture results in order. Use the complete Detailed share text, or enter the total manually.",
      );
    const score = valueOf(match[2]);
    const years = match[3] === "-" ? null : Math.abs(parseInt(match[3], 10));
    const distance =
      match[4] === "-"
        ? null
        : match[4].match(
            new RegExp(String.raw`^(${numeric})\s*(km|mi|m)$`, "i"),
          )!;
    const km =
      distance === null
        ? null
        : valueOf(distance[1]) *
          { km: 1, mi: 1.609344, m: 0.001 }[distance[2].toLowerCase()]!;
    if (
      !Number.isInteger(score) ||
      score < 0 ||
      score > 10000 ||
      (years !== null && years > 2147483647) ||
      (km !== null && (!Number.isFinite(km) || km > 1e9))
    )
      throw new Error(
        `Picture ${index + 1} has an invalid score, year error or distance.`,
      );
    return { points: score, years_off: years, distance_km: km };
  });
  if (rounds.reduce((sum, round) => sum + round.points, 0) !== points)
    throw new Error(
      "The five picture scores don’t add up to the shared total. Copy the complete results again.",
    );
  return { points, dailyNumber, rounds };
}
