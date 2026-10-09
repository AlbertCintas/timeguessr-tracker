import { build } from "esbuild";
import { mkdir, rm, copyFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const directory = "extension-dist";
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
await build({
  entryPoints: [
    "extension/background.js",
    "extension/content.js",
    "extension/popup.js",
  ],
  outdir: directory,
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
for (const file of ["manifest.json", "popup.html", "popup.css"])
  await copyFile(`extension/${file}`, `${directory}/${file}`);
const { version } = JSON.parse(
  await readFile("extension/manifest.json", "utf8"),
);
await mkdir("dist/downloads", { recursive: true });
const archive = `timeguessr-extension-${version}.zip`;
await rm(`dist/downloads/${archive}`, { force: true });
execFileSync("zip", ["-q", "-r", `../dist/downloads/${archive}`, "."], {
  cwd: directory,
});
await copyFile(
  `dist/downloads/${archive}`,
  "dist/downloads/timeguessr-extension-latest.zip",
);
await writeFile(
  "dist/downloads/version.json",
  JSON.stringify({ version, archive }),
);
console.log(`Built extension ${version}: dist/downloads/${archive}`);
