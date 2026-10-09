# Timeguessr Club

A shared tracker for a group of friends, with cumulative wins and points, win percentages, average points per game, daily challenges, and named non-daily games.

The highest submitted score wins; ties award one win to each leader. Scores count immediately, including games with a single submission. Each player has one score per game and can correct their own results. Administrators can correct any result.

New entries automatically read text pasted from Timeguessr’s **Share results** menu. Manual score entry is also available. Use **Detailed** to include picture scores, year errors, and distances; emoji-grid shares import the total only. Confirm the challenge date before saving. Picture details appear in game history and feed the hall of shame: worst game, worst picture, most zero-point pictures, biggest year error, and furthest guess.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env
npm run dev
```

Fill `.env` with your Supabase URL and publishable key. Without a connection, the app displays its setup state.

```sh
npm test
npm run build
```

## Backend setup

Create a Supabase project on the free plan. With the Supabase CLI installed and authenticated:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy accounts --no-verify-jwt
```

In Authentication settings, disable new user signups and anonymous sign-ins, keep email/password authentication enabled, set minimum password length to 10, and set the site URL to `https://albertcintas.github.io/timeguessr-tracker/`. Disable secure password change if email reauthentication is enabled: these accounts use internal identifiers without mailboxes. The `accounts` function authenticates administrator requests itself; invitation redemption is authorized by an expiring single-use token.

The function's `APP_ORIGIN` defaults to `https://albertcintas.github.io`. For local account testing, set it to `http://127.0.0.1:5173` using Supabase secrets, then restore the deployed origin.

For the first administrator, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` privately in your shell, then run:

```sh
node scripts/bootstrap-admin.mjs
```

Open the generated private invitation link, choose a username and password, then use **Manage club** to invite friends. Bootstrap invitations expire after 24 hours; friend invitations after seven days. Username/password authentication uses Supabase Auth; the app collects no email address. Forgotten passwords are reset by the administrator.

## GitHub Pages

Set these repository Actions variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Under **Settings → Pages**, select **GitHub Actions** as the source. Push to `main` or run **Deploy Pages** manually. Only the project URL and publishable key are included in the static bundle. Privileged credentials belong in Supabase only.

Standings, game history, display names, and avatars are public. Database row policies restrict writes to authenticated owners or administrators. Photo uploads accept JPEG, PNG, and WebP up to 2 MB. Daily dates use Europe/Madrid. The app refreshes on focus and every minute.

## Automatic imports

On desktop Chrome or Edge, click **Install extension** on the scoreboard and download the ZIP. Extract it into a permanent folder, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and choose **Load unpacked**. Select the extracted folder, pin the extension, and sign in with your tracker username and password. Refresh any Timeguessr results tab that was open before installation.

The extension captures completed daily and non-daily games, including picture details. Pending imports survive browser restarts and remain attached to the account that captured them. Conflicts need review in the tracker; automatic imports preserve saved scores and can fill missing picture details when the scores match. Pause automatic imports or sign out from the extension popup.

To update, download the latest ZIP, replace the extracted files, and click **Reload** on the browser’s extensions page. Run the installed-extension browser test with `npx playwright install chromium` and `npm run test:extension`. Build both the website and downloadable extension with `npm run build`; build only the extension with `npm run build:extension`. The Pages deployment includes versioned and latest ZIP downloads under `downloads/`.

## Store packages

`npm run build:store` prepares Chrome and Firefox upload ZIPs, a matching source archive, and listing material in `store-artifacts/`. Firefox uses an event page and stores authentication in the extension’s IndexedDB database. Firefox 140 or later is required. The source archive includes build instructions and the dependency lockfile.

Run `npm run lint:firefox`, `npm run test:extension`, and `npm run test:firefox` to validate the packages. Firefox browser tests use an isolated profile and require an installed Firefox; set `FIREFOX_BINARY` if it is outside the standard macOS location. The privacy policy is served at `privacy.html`.
