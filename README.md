# SHK Connect

Flask, SQLAlchemy, Flask-SocketIO and React team workspace. The root directory is the active application. `SHK-CONNECT/` and `SHK-CONNECT-1/` are older snapshots and are not imported or packaged by the root application.

## Local setup

Use Python 3.11 or 3.12 and Node.js 20 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
cd frontend
npm ci
npm run build
cd ..
.\.venv\Scripts\python create_admin.py
.\.venv\Scripts\python app.py
```

Set `SECRET_KEY` in `.env` to a long random value before running. The administrator command prompts for credentials and never resets an existing account. Alternatively, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for first-run creation. There is no automatic default password. Existing accounts and passwords are preserved.

Open http://localhost:5000. Rebuild the frontend after editing React files. Flask reads Vite's manifest to serve the generated bundle; a running Vite server is not needed. `npm run dev` is available for frontend development with the configured backend proxy.

### Separate backend and frontend terminals

From the project directory, start the backend:

```powershell
.\.venv\Scripts\python.exe app.py
```

In another terminal:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. The frontend proxies login, API requests, uploads and Socket.IO to http://127.0.0.1:5000. For a backend on another port, set `$env:BACKEND_URL='http://127.0.0.1:5001'` before starting Vite. Keep the same browser hostname for login and app navigation.

SQLite defaults to `instance/shk_connect.db`. `DATABASE_URL` can select PostgreSQL or MySQL. Startup creates missing tables and roles, but does not migrate existing columns; schema changes require reviewed database migrations. Back up databases before applying migrations. Use a persistent upload directory/volume in production for document and video attachments.

## Verification

Build the frontend first, then run:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

Tests use an in-memory SQLite database and do not change saved project data. They cover login, disabled users, account bootstrap, channel creation/membership, live messages and typing, reply isolation, uploads, routes/bundles, profiles, expenses, tickets and audit logging.

## Deployment

`docker compose up --build` builds the React bundle and waits for MySQL readiness. Supply your own secret and bootstrap credentials. Render uses the Docker image and PostgreSQL. Docker/Render deployment and external database connections must be verified in their target environments. Socket.IO room tracking is process-local; use one worker unless a shared queue is configured.

The UI still has optional features that are not implemented (MFA, profile photos, advanced filters and receipt management). These are not part of the verified chat/account/ledger/ticket flows. Styles and fonts currently use external CDNs and require internet access.


## Slack-style workspace

- Channels retain the existing membership/management rules. Admin, Owner and ED can create channels; use **Manage members** to add teammates.
- Click a teammate under **Direct messages** for private one-to-one messaging. Conversation history, search, typing and live notifications are scoped to the participants.
- **Reply in thread** opens a separate thread panel. Files can be attached to channel messages, DMs or replies.
- Unread badges persist across reloads and devices, and clear when a focused conversation is viewed. Online indicators update with connections; notifications appear in the bell menu.
- Sending waits for server confirmation; failed sends retain the draft. Reconnecting reloads recent messages. Search is available within each conversation.

This update adds `conversation_reads` and `uploaded_files` tables. With the default `AUTO_CREATE_DB=1`, restarting the backend creates them without rewriting existing messages or passwords. Deployments with automatic creation disabled must create these new tables before serving the updated frontend.

New filesystem attachments default to `instance/uploads` and are served through authenticated, conversation-aware routes. Use persistent storage in deployment. Historical `/static/uploads` URLs retain their existing behavior; files already published there are not retroactively made private. For private storage, keep `UPLOAD_FOLDER` outside the static directory.

Frontend state regression tests: `cd frontend` then `npm test`.
The workspace provides the core Slack-style chat workflows; it does not integrate with Slack or provide Slack's enterprise services.
