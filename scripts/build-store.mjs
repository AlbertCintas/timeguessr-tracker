import { mkdir, rm, cp, copyFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const { version } = JSON.parse(
  await readFile("extension/manifest.json", "utf8"),
);
const root = "store-artifacts";
await rm(root, { recursive: true, force: true });
await mkdir(`${root}/source/scripts`, { recursive: true });
await cp("extension", `${root}/source/extension`, { recursive: true });
for (const file of ["package.json", "package-lock.json"])
  await copyFile(file, `${root}/source/${file}`);
await copyFile(
  "scripts/build-extension.mjs",
  `${root}/source/scripts/build-extension.mjs`,
);
await copyFile("extension/store/source-build.md", `${root}/source/README.md`);
execFileSync(
  "zip",
  ["-q", "-r", `../timeguessr-extension-source-${version}.zip`, "."],
  { cwd: `${root}/source` },
);
for (const browser of ["chrome", "firefox"])
  await copyFile(
    `dist/downloads/timeguessr-${browser}-extension-${version}.zip`,
    `${root}/timeguessr-${browser}-extension-${version}.zip`,
  );
await cp("extension/store", `${root}/listing`, { recursive: true });
await mkdir(`${root}/screenshots`, { recursive: true });
console.log(
  `Store packages and matching reviewer source are ready in ${root}/`,
);
