# Reviewer instructions

This extension uses an invitation-only scoreboard. Reviewer credentials are supplied privately with the submission.

1. Open the extension popup and sign in using the supplied tracker username and password.
2. Open https://timeguessr.com/play?mode=daily or https://timeguessr.com/play and complete all five pictures. A Timeguessr account is not required.
3. Leave the finished results screen open. The extension captures the result automatically and displays its upload status in the popup.
4. Open https://albertcintas.github.io/timeguessr-tracker/ to view the score and picture details. Sign in there with the same reviewer credentials to edit or delete the submitted score.
5. Reload the Timeguessr results screen. An identical saved result does not create another entry. Conflicting replays require review and preserve the saved result.
6. Disable automatic imports in the popup to pause capture and uploads. Sign out to remove the locally saved session.

The extension is independent of Timeguessr. It collects completed results only on Timeguessr and calls the project’s Supabase host for authentication and uploads. The privacy policy is https://albertcintas.github.io/timeguessr-tracker/privacy.html.
