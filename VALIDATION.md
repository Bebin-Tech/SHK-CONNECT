# Migration validation

Local validation on 2026-11-23:

- FastAPI integration tests: all 14 passed on both SQLite and PostgreSQL, covering authentication/session revocation, roles, private conversations/threads/files, pagination/unread, removed Ledger/Support endpoints, private thread inbox, and audit, validation/throttling, legacy passwords, reversible Alembic migrations, and normalized registration.
- Flutter analyzer and focused Python lint checks passed.
- PostgreSQL 17: initial migration, Alembic schema comparison, and real API smoke flow passed using a dedicated `shk_connect_test` database.
- Existing data copied into local PostgreSQL `shk_connect`: 6 users, 1 channel, 2 membership rows, 4 messages. Original SQLite file preserved; an additional backup is in `.test-artifacts/legacy-database-before-fastapi.db`. Passwords were preserved.
- Flutter widget tests: 7 passed, including messaging at 390×844, 768×1024 and 1440×900, narrow login at enlarged text scale, failed-send draft retention, private-route cleanup on sign-out, and inline desktop threads/the thread inbox.
- Flutter release Web build passed; Wasm dry run passed. The build emits a harmless optional Cupertino icon font warning from a dependency; the app uses Material icons.
- Running FastAPI: `GET /api/health` and `GET /` returned HTTP 200. Browser inspection confirmed the Flutter login page renders.
- Android build attempted: blocked before Gradle compilation because this host cannot execute `client/android/gradlew.bat`. Flutter Doctor also reports access failure on the installed Android SDK's `sdkmanager.bat`.
- iOS builds require macOS/Xcode. Native compile checks are configured in `.github/workflows/verify.yml`, but no remote CI run is claimed.

The source is configured for all three platforms; Android/iOS device behavior, signing, store distribution, gateway/TLS deployment, backup restoration, and production load tests remain release checks. Production configuration enforces PostgreSQL, explicit origins/hosts and secure refresh cookies.

Current workspace redesign: Ledger and Support UI/API operations are removed. Historical tables remain for migration compatibility. The client now uses a purple Slack-style workspace rail/sidebar, Home/DMs/Activity/People navigation, a thread inbox, and an inline thread pane on wide desktop layouts.

After the redesign, all 14 backend tests passed on both SQLite and PostgreSQL; all 7 Flutter widget tests and the Flutter analyzer passed. The release Web build succeeded. Live HTTP checks confirmed the updated Flutter bundle, authenticated workspace and thread routes, and 404 responses for both removed module APIs. Automated browser inspection was unavailable because the browser connection timed out; responsive rendering and thread interactions were checked through Flutter widget tests.

Glass-blue/milky-white restyle: Flutter analyzer and all 7 existing UI tests passed; release Web build and Wasm dry run succeeded. The served bundle checksum matches the new build, and the live manifest uses blue #D2E8FC with milky white #F8FAFD.
