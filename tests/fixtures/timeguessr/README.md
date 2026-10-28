These fixtures preserve Timeguessr's indexed SvelteKit JSON protocol as observed on 2026-10-27. They retain only original answer metadata (year, location, country and description), round order, archive date/identity/link fields and replay identity strings. Unused values (including image URLs and public client configuration) are replaced with null; indices are preserved. They contain no player guesses or authenticated responses.

Sources:

- `archive-october.json`: `https://timeguessr.com/archive/__data.json?month=2026-10`
- `daily-1227.json`: the signed daily link published by that archive for 2026-10-09, requested through `/play/__data.json`.
- `daily-current.json`: `https://timeguessr.com/play/__data.json?mode=daily`, verified against the archive's current daily identity.
- `replay.json`: `/game-settings/__data.json?RA=...` for the complete replay identity preserved in the fixture.

Tests reject mismatched identities, missing sources and malformed data instead of inferring any answers.
