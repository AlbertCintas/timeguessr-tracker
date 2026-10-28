// Builds public/world-places.json from GeoNames (CC BY 4.0): every town of
// 15,000+ people, without city districts (PPLX), with its first-level region
// and its population in thousands.
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = "https://download.geonames.org/export/dump";
const download = async (file) => {
  const response = await fetch(`${source}/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const rows = (text) =>
  text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));

const dir = await mkdtemp(join(tmpdir(), "geonames-"));
try {
  const zip = join(dir, "cities15000.zip");
  await writeFile(zip, await download("cities15000.zip"));
  const cities = rows(
    execFileSync("unzip", ["-p", zip, "cities15000.txt"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  ).filter((c) => c[7] !== "PPLX");
  const admin1 = new Map(
    rows((await download("admin1CodesASCII.txt")).toString("utf8")).map(
      ([key, name]) => [key, name],
    ),
  );

  const regions = [];
  const regionIndex = new Map();
  const places = cities.map((c) => {
    const [name, lat, lng, country, code] = [c[1], c[4], c[5], c[8], c[10]];
    const thousands = Math.round(+c[14] / 1000);
    const key = `${country}.${code}`;
    if (!regionIndex.has(key)) {
      regionIndex.set(key, regions.length);
      regions.push([country, admin1.get(key) ?? ""]);
    }
    return [
      name,
      regionIndex.get(key),
      +(+lat).toFixed(2),
      +(+lng).toFixed(2),
      thousands,
    ];
  });
  await writeFile(
    new URL("../public/world-places.json", import.meta.url),
    JSON.stringify({ regions, places }),
  );
  console.log(`${places.length} places in ${regions.length} regions`);
} finally {
  await rm(dir, { recursive: true });
}
