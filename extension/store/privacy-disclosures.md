# Store disclosures

Single purpose: import the signed-in player’s completed Timeguessr results into the Timeguessr Club scoreboard.

Data categories: authentication information, pseudonymous account identifiers and website content (completed game results). Game distances are errors within a guessing game, not the player’s physical location. No advertising, analytics, sale of data or unrelated browsing collection.

Permissions:

- `storage`: remember account metadata, import settings, pending games and recent upload status; Chrome also stores authentication in restricted storage.
- `alarms`: retry pending uploads after connectivity returns or the browser restarts.
- Timeguessr hosts: read completed results and fetch public daily metadata.
- The project’s Supabase host: authenticate tracker accounts and upload results.

All executable code is bundled locally. Network responses contain data, not executable code. Firefox requires `authenticationInfo` and `websiteContent` consent at installation.
