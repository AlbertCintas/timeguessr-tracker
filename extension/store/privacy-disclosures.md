# Store disclosures

Single purpose: import the signed-in player’s completed Timeguessr results into the Timeguessr Club scoreboard.

Data categories: authentication information, pseudonymous account identifiers and website content (completed game results). Game distances are guess errors; correct answer years and coordinates describe featured photographs, not the player’s physical location. Answers are publicly displayed in picture breakdowns and aggregated into location and year charts. No advertising, analytics, sale of data or unrelated browsing collection.

Permissions:

- `storage`: remember account metadata, import settings, pending games and recent upload status; Chrome also stores authentication in restricted storage.
- `alarms`: retry pending uploads after connectivity returns or the browser restarts.
- Timeguessr hosts: read completed results, fetch public daily metadata, and automatically recover original photograph answers for already-played club games from public archive and replay page data. Backfill omits Timeguessr cookies, submits no scores, and pauses with auto-import.
- The project’s Supabase host: authenticate tracker accounts and upload results.
- No extra permission: on “Check for updates”, the popup asks the browser store for an update and reads the public `version.json` from the tracker site on GitHub Pages.

All executable code is bundled locally. Network responses contain data, not executable code. Firefox requires `authenticationInfo` and `websiteContent` consent at installation.
