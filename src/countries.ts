// Timeguessr's own country names that the browser's region names do not match.
const aliases: Record<string, string> = {
  usa: "US",
  uk: "GB",
  uae: "AE",
  turkey: "TR",
};
let regions: Map<string, string> | null = null;

/** ISO 3166 code for a Timeguessr country name, or null when it has none. */
export function countryCode(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (aliases[key]) return aliases[key];
  if (!regions) {
    regions = new Map();
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        try {
          // Deprecated codes (DD, VD, FX…) share names with current ones.
          if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`)
            continue;
          const region = names.of(code);
          if (region && region !== code)
            regions.set(region.toLowerCase(), code);
        } catch {
          // Codes outside the browser's region list have no name.
        }
      }
  }
  return regions.get(key) ?? null;
}

/** Regional-indicator flag emoji, empty when the country has no code. */
export function flag(name: string) {
  const code = countryCode(name);
  return code
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "";
}

const continents: Record<string, string> = {
  Africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW RE YT SH",
  Asia: "AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  Europe:
    "AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA AX SJ",
  "North America":
    "AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US PR GL BM KY TC VG VI AW CW SX BQ MQ GP BL MF PM AI MS",
  "South America": "AR BO BR CL CO EC GY PY PE SR UY VE GF FK",
  Oceania:
    "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU NC PF GU AS MP CK NU TK WF NF",
  Antarctica: "AQ",
};
const continentByCode = new Map(
  Object.entries(continents).flatMap(([continent, codes]) =>
    codes.split(" ").map((code) => [code, continent] as const),
  ),
);

/** Continent of a Timeguessr country name, or null when unknown. */
export function continentOf(name: string): string | null {
  if (name === "Palestinian territories or Israel") return "Asia";
  const code = countryCode(name);
  return code ? (continentByCode.get(code) ?? null) : null;
}
