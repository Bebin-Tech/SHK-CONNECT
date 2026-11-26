# SHK Connect 2

One Flutter application for **iOS, Android, and Web**, backed by a shared **Python FastAPI REST API** and **PostgreSQL** in production. The active app contains no React, Vite, Node.js server, Flask, or Socket.IO dependencies.

## Online phone app

The deployed API is **https://shk-connect-api-production.up.railway.app/api/v1**. Its [health endpoint](https://shk-connect-api-production.up.railway.app/api/health) is public; workspace data requires login. The backend runs on Railway with private PostgreSQL and persistent attachment storage. The deployment image in `deploy/Dockerfile` serves the API; it does not bundle the Web frontend.

Use **SHK Connect Online** on Android (`com.shkconnect.shk_connect.online`). This build uses HTTPS over Wi-Fi or mobile data and does not require USB, the development computer, or its local API. Existing accounts/passwords were migrated unchanged. The separate package keeps the earlier USB-testing installation intact. The GitHub Actions artifact `shk-connect-android-debug` now contains this online build.

The current Railway backend was uploaded with the authenticated Railway CLI because the Railway GitHub connection did not have repository access. GitHub pushes build the Android artifact but do not automatically update that backend. Deploy backend changes using `railway up` against project `f44266bc-0c44-4473-8de4-7912cc7b13d7`, production environment `99e42fcb-ad02-48fb-acab-9753230185bc`, service `8fb01ba7-8f30-4fa3-8dd9-55fbf0a0ffe1`, or connect the GitHub repository in Railway to enable automatic backend deployments. Keep the Dockerfile path set to `deploy/Dockerfile`.

The initial migration used private service variables and the database's private network, without a public database TCP endpoint. `backend.cloud_seed` supports an empty-database import and a conflict-checked final delta for messages sent during cutover. One-time migration variables were cleared after the migration. Local database copies are retained as backups; the online database is now the phone app's source of truth.

## Run on Windows

Prerequisites: Python 3.12 and Flutter 3.41.9 (Dart 3.11). From the project root:

```powershell
.\scripts\run-dev.ps1
```

This installs Python requirements, creates a local signing secret if `.env` is absent, builds Flutter Web, applies Alembic migrations, and serves the complete app at **http://localhost:5000**. Later use `-SkipBuild` if Dart files have not changed. API documentation is at `/api/docs` in development. There is no default password.

Create the first administrator if you are starting with an empty database:

```powershell
.\.venv\Scripts\python -m backend.cli create-admin
```

Fresh local setups default to `instance/connect_v2.db`. This workspace has been configured to use PostgreSQL on `127.0.0.1:55432`, in the persistent Docker container `shk-connect-postgres-dev`. Start it after reboot with `docker start shk-connect-postgres-dev`. The existing users, membership, and messages have been imported without changing passwords. Production settings reject SQLite and insecure cookies. Configure `.env` from `.env.example`; never commit it. Server-side registration is disabled by default. Administrators create teammates from **Team → Add teammate**.

## One client, three platforms

### Test on an Android phone over USB

For a local-only development build, enable **USB debugging**, connect a data-capable USB cable, and accept the computer authorization prompt on your phone. Build with `flutter build apk --debug --dart-define=API_BASE_URL=http://127.0.0.1:5000/api/v1`, then use the resulting `app-debug.apk`. The standard GitHub artifact targets the online API and does not need these forwarding steps:

```powershell
adb devices
adb reverse tcp:5000 tcp:5000
adb install -r app-debug.apk
adb shell am start -n com.shkconnect.shk_connect/.MainActivity
```

Keep this computer, its PostgreSQL container, and FastAPI running while testing. After reconnecting USB, run `adb reverse tcp:5000 tcp:5000` again. The same account data is shared with the Web app. For local Flutter debugging, run `flutter run -d <device-id> --dart-define=API_BASE_URL=http://127.0.0.1:5000/api/v1` after forwarding the port. The debug APK is for development; production builds use your HTTPS API endpoint and release signing.

All screens, domain models, repositories, and API contracts live under `client/lib`. There are no separate mobile features or alternate frontend. Desktop uses persistent navigation and a split conversation view; tablet uses a split view with bottom navigation; phone uses a conversation list and a dedicated conversation screen. All sizes expose channels, direct messages, unread activity, threads, people, account settings, and role-appropriate administration. The glass-blue workspace sidebar, milky-white surfaces, compact messages, and desktop thread pane follow familiar Slack-style navigation. Translucent panels use a soft blue gradient with frosted blur, navy text, and blue action buttons.

```powershell
cd client
flutter pub get
flutter run -d chrome --web-port 8080 --dart-define=API_BASE_URL=http://localhost:5000/api/v1
flutter run -d <android-device> --dart-define=API_BASE_URL=https://your-domain/api/v1
flutter build appbundle --release --dart-define=API_BASE_URL=https://your-domain/api/v1
```

On macOS with Xcode, CocoaPods, and your Apple signing team:

```sh
cd client
flutter run -d <ios-device> --dart-define=API_BASE_URL=https://your-domain/api/v1
flutter build ipa --release --dart-define=API_BASE_URL=https://your-domain/api/v1
```

Production native apps require an HTTPS API URL. Android emulator development defaults to `10.0.2.2:5000`; iOS simulator defaults to `127.0.0.1:5000`. Physical devices need an accessible host. Android allows HTTP only in debug. iOS keeps App Transport Security enabled: use an HTTPS development endpoint. Configure your own Android upload keystore and Apple certificates before store distribution; no production build uses a debug signing key. Native platform directories are checked in. Store submission, real device checks, and signing require the appropriate platform credentials and toolchains.

Web uses same-origin API paths by default and supports hash navigation without server rewrites. A separately hosted Flutter Web frontend must use the **same site** as the API for Strict refresh cookies, an explicit `API_BASE_URL`, and matching CORS origins. Flutter's JavaScript/Wasm build output is generated from Dart; it does not introduce a Node.js runtime. `--no-web-resources-cdn` bundles engine resources locally.

## Workflows

Ledger and Support have been removed from both the UI and REST API. Their historical database tables are retained for data preservation and migration compatibility; no ledger or support operations are exposed.

- Channels: create, edit, manage membership, archive/restore, and search retained history.
- Conversations: scoped direct messages, threads, pinning, cursor-based history, unread counts, online/typing indicators, private attachments up to 20 MB, and in-memory drafts per conversation. Sends use client IDs for safe retries. Downloads use native file storage or browser downloads.
- Team and account: administrator-created users, role/access management, profile/password changes, session revocation, and privileged audit history. Deactivation preserves authored records.
- Updates: foreground REST polling every 3 seconds for open conversations and every 10 seconds for the workspace. Polling pauses while the application is backgrounded. This release does not use background push notifications or provide offline message synchronization. Unsent drafts are held in memory, not permanently stored.

## Architecture and security

```text
client/lib/
  core/        JSON transport, single-flight refresh, platform HTTP adapters
  domain/      typed account, conversation, and message models
  data/        workspace repository
  state/       application/session controller
  ui/          responsive views and reusable forms/theme
backend/app/
  api/         authentication, workspace, administration REST routers
  core/        validated configuration, JWT, passwords, RBAC
  conversations.py  shared conversation authorization and serialization
  models.py    SQLAlchemy persistence models
  schemas.py   Pydantic request validation
backend/migrations/  versioned Alembic schema
```

Access JWTs expire after 15 minutes, validate issuer/audience/type/signature, and reference a revocable server session. Refresh JWTs rotate on each use, have a 30-day absolute session limit, and are stored as hashes in the database. Replay revokes the session. Logout, password changes, and user role/access changes revoke affected sessions. Roles are read from the database on requests. New passwords use Argon2. Historical scrypt/PBKDF2 hashes upgrade at successful login without retaining a web framework dependency.

Web access tokens stay in memory; refresh tokens use HttpOnly, SameSite=Strict cookies (Secure in production). Native refresh tokens use Keychain/Android protected storage. Authentication endpoints check browser origins and Fetch Metadata. Database-backed sign-in throttling blocks repeated attempts per identifier and direct client IP; put additional global/IP throttling at your trusted gateway. No credentials belong in Dart compile-time configuration. File IDs are generated by the server, storage is private, downloads require conversation access, and uploads are served as downloads rather than executable content.

API workers are stateless with sessions, unread cursors, and presence in the shared database. SQL aggregation and indexed, bounded history queries keep message payloads small. Mount durable shared attachment storage for multiple hosts; PostgreSQL pooling and gateway rate limits should be tuned against measured traffic. Large deployments should replace local files with a private object-storage adapter and signed, authorized downloads.

## Existing data

`instance/shk_connect.db` is the preserved legacy database. The new schema uses a separate database; never point Alembic at the legacy file. The retired application source was backed up locally under `.test-artifacts/legacy-source-before-flutter.zip` before removal. Existing static uploads were moved to `instance/legacy-static-uploads`; existing private uploads remain under `instance/uploads`.

Preview the legacy import, then import into an **empty, migrated destination** configured by `DATABASE_URL`:

```powershell
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m backend.import_legacy --source instance/shk_connect.db
.\.venv\Scripts\python -m backend.import_legacy --source instance/shk_connect.db --apply
```

The importer preserves user IDs, password hashes, channel membership, messages/threads, expenses, tickets, audit records and read cursors. It copies embedded/local message attachments into private storage and resets PostgreSQL sequences. The source is opened read-only. Missing files or unsupported external attachment URLs abort and roll back the destination import; copied files are removed on failure. Legacy group invite codes, channel avatar images, expense receipt URLs, and historical IP fields are not part of the new schema. Back up the source and review the preview before production migration. The local source archive is excluded from Git and deployment images.

## PostgreSQL deployment

Set `JWT_SECRET` to at least 32 random characters, `POSTGRES_PASSWORD` to a URL-safe random value, and JSON arrays `CORS_ORIGINS`/`ALLOWED_HOSTS` to your HTTPS domain in `.env`.

```sh
docker compose up --build -d
docker compose exec api python -m backend.cli create-admin
```

Compose starts PostgreSQL 17, waits for readiness, applies migrations in one dedicated process, and serves the Flutter bundle/API using non-root Uvicorn workers. The API port is bound to host loopback; terminate TLS at your gateway. Set a 21 MB request-body cap and rate limits there. Secure web login requires HTTPS in production. Preserve the PostgreSQL and uploads volumes; do not delete volumes when upgrading. Back up both, and rehearse restoration and migration rollback on a staging copy before deployment. `render.yaml` is an alternative managed PostgreSQL/Docker configuration and needs your domain and persistent disk configuration. No deployment has been published automatically.

## Validation

```powershell
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest backend/tests -q
cd client
flutter analyze
flutter test
flutter build web --release --no-web-resources-cdn
```

Backend tests default to temporary SQLite databases, not saved project data. `SHK_TEST_DATABASE_URL` selects a disposable PostgreSQL database whose name must end in `_test`; the fixture recreates its application tables. The backend suite covers authentication, private messaging, and administration. Tests cover access/refresh/logout, replay, disabled users, CSRF origins, expiry, role enforcement, conversation/thread/file isolation, unread/pagination, removed-module API isolation, private thread inbox, audit, throttling, legacy password compatibility, and reversible schema migration. Flutter widget tests exercise phone/tablet/desktop conversation and send flows, enlarged-text login, failed-send draft retention, private-route cleanup on sign-out, and side-by-side desktop threads. CI also checks PostgreSQL, Android debug compilation, and unsigned iOS compilation. CI configuration is provided; remote CI results are not implied by local checks. See `VALIDATION.md` for the local evidence and remaining platform release checks.

Design references: [Flutter architecture](https://docs.flutter.dev/app-architecture/guide), [adaptive layouts](https://docs.flutter.dev/ui/adaptive-responsive), and [FastAPI JWT security](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/).

## Shared file previews

Messages and pending uploads use type-aware attachment cards with the filename, detected format, size, and preview/download actions. PNG, JPEG, GIF and WebP images show inline previews and a zoomable viewer. PDFs open in the shared Flutter PDF viewer. Word DOCX files have a text preview; Excel XLSX and CSV files have bounded, horizontally scrollable values previews. Plain text and common text formats are displayed as text, never as executable HTML. Legacy Office files, presentations, archives, audio/video and unknown formats have distinct icons and can be downloaded to open in a compatible app.

Previews require the same authentication and conversation access as the original download. Upload MIME headers are not trusted for image/PDF detection. Office previews do not execute formulas or macros and explicitly describe their limits (up to 5 sheets, 50 rows, 12 columns, or 30,000 text characters). Files are limited to 20 MB; empty uploads are rejected. Native downloads use a Save As picker; Web uses the browser download flow. Preview failures offer retry and original download.
