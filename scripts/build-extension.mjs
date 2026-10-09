import { build } from "esbuild";
import { mkdir, rm, copyFile, readFile, writeFile, cp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
const firefox = JSON.parse(
  await readFile("extension/manifest.firefox.json", "utf8"),
);
await mkdir("dist/downloads", { recursive: true });
for (const browser of ["chrome", "firefox"]) {
  const directory =
    browser === "chrome" ? "extension-dist" : "extension-firefox-dist";
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
    target: browser === "chrome" ? "chrome140" : "firefox140",
    minify: false,
    legalComments: "eof",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const target = browser === "chrome" ? manifest : { ...manifest, ...firefox };
  if (browser === "firefox") delete target.minimum_chrome_version;
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(target, null, 2) + "\n",
  );
  for (const file of ["popup.html", "popup.css"])
    await copyFile(`extension/${file}`, `${directory}/${file}`);
  await cp("extension/icons", `${directory}/icons`, { recursive: true });
  const archive = `timeguessr-${browser}-extension-${manifest.version}.zip`;
  await rm(`dist/downloads/${archive}`, { force: true });
  execFileSync("zip", ["-q", "-r", `../dist/downloads/${archive}`, "."], {
    cwd: directory,
  });
  if (browser === "chrome") {
    await copyFile(
      `dist/downloads/${archive}`,
      `dist/downloads/timeguessr-extension-${manifest.version}.zip`,
    );
    await copyFile(
      `dist/downloads/${archive}`,
      "dist/downloads/timeguessr-extension-latest.zip",
    );
  }
  await copyFile(
    `dist/downloads/${archive}`,
    `dist/downloads/timeguessr-${browser}-extension-latest.zip`,
  );
  console.log(
    `Built ${browser} extension ${manifest.version}: dist/downloads/${archive}`,
  );
}
await writeFile(
  "dist/downloads/version.json",
  JSON.stringify({
    version: manifest.version,
    archive: `timeguessr-chrome-extension-${manifest.version}.zip`,
  }),
);
