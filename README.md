# Soultrack

A music streaming platform built with two parts:

1. **`soultrack-server/`** — A single Render-deployable Node.js service combining:
   - **REST API** (`GET /api/songs`, `GET /api/playlists`, `GET /api/version`, `POST /api/songs/:id/play`)
   - **Background Ingestion Worker** (YouTube URL via `yt-dlp` + `ffmpeg -movflags +faststart` → Cloudflare R2 + PostgreSQL, plus direct audio file uploads)
   - **Admin Web Panel** (served at `/` for managing songs, playlists, and Android APK release info)
2. **`soultrack-mobile/`** — Native Android app (Kotlin, Jetpack Compose, Material 3, Media3 ExoPlayer):
   - Background playback with `MediaSessionService` (notification & lock-screen controls, audio focus, auto-pause on headphone disconnect)
   - Auto-next, shuffle, repeat modes (`Off` / `All` / `One`), disk audio cache (`SimpleCache`), and queue view
   - In-App Self Updater (`GET /api/version` + `FileProvider` APK install prompt)

*(The previous 2-person React/Supabase PWA is preserved in Git on branch `archive/two-person-pwa` and on `main` prior to this refactor.)*

---

## Part 1: `soultrack-server` Setup (Render + Neon/Supabase + Cloudflare R2)

### Database (Neon DB or Supabase Postgres)
- Create a Postgres database on **Neon** (or use a **Supabase** Postgres connection string).
- Schema lives in `soultrack-server/sql/001_init.sql` and runs automatically on startup when `AUTO_MIGRATE=true` (or manually via `npm run migrate`).

### Local Run
```bash
cd soultrack-server
cp .env.example .env
# Edit .env (for quick local testing without R2, set STORAGE_MODE=local)
npm install
npm test
npm start
```
Open `http://localhost:3000` in your browser to sign into the Admin Panel using `ADMIN_SECRET`.

### Deploy to Render
- `soultrack-server/Dockerfile` installs Node 22, `ffmpeg`, `python3`, and `yt-dlp`.
- `soultrack-server/render.yaml` defines the Docker web service (`rootDir: soultrack-server`).
- Configure these environment variables on Render:
  - `DATABASE_URL` (Neon or Supabase Postgres connection string)
  - `ADMIN_SECRET` (your Admin Web Panel password)
  - `STORAGE_MODE=r2`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
  - `PUBLIC_BASE_URL` (your Render URL, e.g. `https://soultrack-server.onrender.com`)

> **Note on YouTube Ingestion:** YouTube frequently blocks datacenter IPs (such as Render) and scraping audio violates YouTube Terms of Service. The Admin Panel also includes direct audio file upload to Cloudflare R2 as a reliable fallback.

---

## Part 2: `soultrack-mobile` Setup (Android Kotlin)

Open `soultrack-mobile/` in **Android Studio**, or build from PowerShell:
```powershell
cd soultrack-mobile
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat testDebugUnitTest assembleDebug
```

To bake your Render server URL into the APK at build time:
```powershell
.\gradlew.bat assembleRelease -PSOULTRACK_SERVER_URL=https://your-service.onrender.com
```
You can also change the server URL anytime inside the app under the **Settings** tab.
