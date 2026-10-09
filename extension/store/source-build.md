# Build the extension

Use Node.js 22 or later, npm and the `zip` command on macOS or Linux. The build uses esbuild and the versions pinned in `package-lock.json`.

```sh
npm ci
npm run build:extension
```

Chrome files are written to `extension-dist/`; Firefox files are written to `extension-firefox-dist/`. Submission ZIPs are written to `dist/downloads/`. No credentials, environment file or backend access are needed to build.
