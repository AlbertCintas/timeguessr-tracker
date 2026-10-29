# Timeguessr Club

A shared tracker for a group of friends, with cumulative wins and points, win percentages, average points per game, daily challenges, and named non-daily games.

The highest submitted score wins; ties award one win to each leader. Scores count immediately, including games with a single submission. Each player has one score per game and can correct their own results. Administrators can correct any result.

New entries automatically read text pasted from Timeguessr’s **Share results** menu. Manual score entry is also available. Use **Detailed** to include picture scores, year errors, and distances; emoji-grid shares import the total only. Confirm the challenge date before saving. Picture scores and errors appear in game history and feed the hall of shame, the hall of fame and player stats. The club page has five tabs: Standings, Hall of shame, Hall of fame, Player stats and History. The period picker applies to the standings, both halls and player stats. The top bar's **Club | Atlas** switch opens the Atlas, a separate page about the pictures themselves. Average records need 20 detailed pictures.

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

On desktop Chrome or Edge, click **Browser extension** in the top bar, then **Install browser extension** to open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/goaihidkkladlkkkhagodpiimokmgedo?utm_source=item-share-cb). Pin the extension and sign in with your tracker username and password. Refresh any Timeguessr results tab that was open before installation. On Firefox, the same button opens the [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/timeguessr-club/). The **Prefer a manual install?** link opens a separate popup with ZIP downloads and instructions.

The extension captures completed daily and non-daily games, including picture details. Pending imports survive browser restarts and remain attached to the account that captured them. Conflicts need review in the tracker; automatic imports preserve saved scores and can fill missing picture details when the scores match. Pause automatic imports or sign out from the extension popup.

Store installations update automatically. To update a manual installation, download the latest ZIP, replace the extracted files, and click **Reload** on the browser’s extensions page. Run the installed-extension browser test with `npx playwright install chromium` and `npm run test:extension`. Build both the website and downloadable extension with `npm run build`; build only the extension with `npm run build:extension`. The Pages deployment includes versioned and latest ZIP downloads under `downloads/`.

## Store packages

`npm run build:store` prepares Chrome and Firefox upload ZIPs, a matching source archive, and listing material in `store-artifacts/`. Firefox uses an event page and stores authentication in the extension’s IndexedDB database. Firefox 140 or later is required. The source archive includes build instructions and the dependency lockfile.

Run `npm run lint:firefox`, `npm run test:extension`, and `npm run test:firefox` to validate the packages. Firefox browser tests use an isolated profile and require an installed Firefox; set `FIREFOX_BINARY` if it is outside the standard macOS location. The privacy policy is served at `privacy.html`.

## Atlas

`atlas.html` has four tabs, all following the period picker. To avoid spoilers, a daily game's pictures appear from the next day (Madrid time) and other games' three days after the club first played them:

- **Map**: pictures binned into 3° areas, one circle per area. Colors have four classes: 1 picture, two round log-spaced steps (1-2-3-5 series) and the busiest area, so one crowded city cannot wash out the rest.
- **Trivia**: cards about single pictures: the oldest, and the lowest and highest club average score, biggest score gap, biggest average year error, most exact-year guesses, and smallest and largest average distance. Club averages need at least two players with picture details and never name players. Each card shows Timeguessr's caption in a tooltip.
- **Countries**: pictures per continent and per country, with flags and the date each country last appeared.
- **Years**: pictures per decade with the club's average years off for each decade, a bar per exact year, and the most common years.

Extension v1.2.0 captures the actual answer year and latitude/longitude from completed Timeguessr results (modern `roundResults.actualYear` / `actualCoords`, falling back to image `Year` / `Location`; legacy image arrays use the same fields). These are photograph locations, not players’ physical locations. Guessed years, guessed coordinates and error magnitudes are never used to derive correct answers.

The period picker uses the same game dates as the standings. Each round counts once per game across all players; repeated appearances in separate games count separately. Backfilled site answers take precedence over capture metadata. Partial captures can supply each other’s missing fields; conflicting capture fields are excluded when no backfilled answer is available. Coverage includes all five pictures of each played game, including total-only submissions with missing answers.

### Automatic historical backfill

While signed in with auto-import enabled, the extension automatically fills missing answers for **already-played club games**, including games with total-only submissions. Any signed-in club member’s extension can backfill shared photograph metadata; scores, player guess errors and game identities remain untouched. No Timeguessr sign-in or manual reopening is needed.

- Daily games: read the official archive month, match the exact saved date, follow its published signed link, then verify all five photographs have the expected daily number. For the current daily, follow the archive’s explicitly marked current-game route and verify the same identity. The archive month is retained as dated provenance until a signed archive link exists.
- Store each picture's year, coordinates, country and caption. A reworded caption keeps the stored one; a different year, location or country is a conflict.
- Replay games: fetch the original photographs from Timeguessr’s game-settings data and verify that the complete returned replay ID matches the saved one.
- Read only Timeguessr’s structured JSON page data. Never execute page scripts, submit scores, play a game or infer answers from guesses. Requests omit Timeguessr cookies.
- Process up to three games per batch on login, browser startup, extension startup and the existing one-minute alarm. Completed backfills are idempotent. Network/server failures retry after five minutes; unavailable or conflicting sources are checked again after 24 hours. Pause auto-import or sign out to pause backfill. The popup shows the latest status.
- Games without a saved replay ID, or no longer available on the site, remain missing. The existing result capture can still enrich them if a completed results page retains their data.

Shared answers, with each picture's caption in a tooltip, appear in History only to signed-in members who have a result for that game. They count in the Atlas even when players submitted only total scores. The tracker refreshes automatically, so recovered answers flow into the Atlas without another score submission.

`20261027125144_featured_answers.sql` must be applied before extension v1.2.0 is released. It adds shared answer metadata and narrowly scoped backfill functions. Only authenticated club members can backfill an existing game with at least one submitted result; the extension receives no privileged database key, and direct game updates and score permissions remain unchanged.

The map uses a bundled [Natural Earth 1:110m land outline](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), which is public domain. It requires no map account, external tile requests or additional browser permissions.
