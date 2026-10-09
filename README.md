# Timeguessr Club

A shared tracker for a group of friends, with cumulative wins and points, win percentages, average points per game, daily challenges, and named non-daily games.

The highest submitted score wins; ties award one win to each leader. Scores count immediately, including games with a single submission. Each player has one score per game and can correct their own results. Administrators can correct any result.

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
