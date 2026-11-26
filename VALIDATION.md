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

Online deployment on 2026-11-24:

- Railway API and private PostgreSQL deployments are healthy at `https://shk-connect-api-production.up.railway.app`; both have persistent 500 MB volumes within the current plan limits. No public database proxy was created.
- Initial migration and final cutover sync completed through private service variables. Migration tests cover password preservation, repeatable import, synchronization of new messages, and atomic rejection of conflicting edits.
- Verified all six existing logins/roles, two channels, and five currently accessible messages/replies/DMs against the HTTPS API. Historical orphan message rows are retained in storage but are not public conversations.
- The HTTPS-configured Android APK passed GitHub CI and was installed and launched as `SHK Connect Online` on the physical phone. Verified the bundled production API URL, removed USB API forwarding, and stopped the local development API. The phone app no longer depends on that computer's backend.
- The one-time migration configuration values were cleared; local backups are retained. The production backend uses a separate signing secret and revocable cloud sessions.

## Light translucent UI — 2026-11-25

Updated shared Flutter surfaces with a milky gradient, translucent panels, softer borders, rounded inputs, and a lighter composer/navigation. Flutter analysis and formatting passed. All seven existing responsive interaction checks passed, including 390px phone, 768px tablet, 1440px desktop, narrow large-text login, failed-send drafts, sign-out, and inline threads. Reviewed rendered phone/tablet/desktop previews. Phone was disconnected during verification; Android installation was not performed.


## File recognition and previews — 2026-11-26

- Backend: 26 tests passed, including detection independent of upload MIME, private preview permissions, Word/Excel/CSV parsing, malformed document fallback, bounded text/XML, and recognition of older generic uploads. Ruff fatal checks passed.
- Flutter: existing responsive checks passed; five new attachment checks passed for upload-size rejection before stream reads, attachment-only sending, type/size details, spreadsheet preview on a 320px screen, image download reuse/zoom, retry, and unsupported file details.
- Flutter analysis passed. Release Web build passed with the online API. Android/iOS builds are verified through the repository workflow.
- Office previews show values/text; original formatting, macros, and legacy binary Office previews are not reproduced. Unsupported formats retain original download.

## Notifications and native app lock — 2026-11-26

Added private inbox and SSE APIs, role-restricted academic notifications, transactional message notifications, device/session binding, preferences and a leased push outbox. New backend tests cover idempotency, role and recipient privacy, read access, muted preferences, retry payload privacy, logout revocation and device reassignment. Flutter analysis passes; all 16 Flutter tests pass, including cold-launch gating, failed authentication, timeout/account isolation, lock coverage over private routes, password fallback, notification deduplication and existing responsive/file flows. Native push delivery and real biometric hardware still require signed app/device verification; iOS background push also requires the owner's APNs key and provisioning.

Notification follow-up: all 31 backend tests and 16 Flutter tests passed. GitHub verified PostgreSQL, Web, Android and unsigned iOS builds, including native Firebase resources. Railway deployed the schema and notification endpoints successfully. Google OAuth verified the locally held service-account credential, which was installed via stdin as a Railway secret; the unusable first key was removed with owner approval. A Firebase validate-only send reached FCM and returned NOT_FOUND for an intentionally unregistered address; no production notification was sent. Live HTTPS checks confirmed health, private inbox and configured push status. Hardware notification/biometric behavior needs the updated phone build and user interaction. The owner has no Apple Developer/APNs setup yet; iOS background push remains pending that setup.
