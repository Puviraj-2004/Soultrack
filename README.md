# 🎵 Soultrack

**Soultrack** is a full-stack, self-hosted music streaming ecosystem built for seamless audio playback, smart catalog curation, and modern visual aesthetics. It combines a native **Android (Jetpack Compose + Media3)** mobile player with a **Node.js + Neon PostgreSQL + Cloudflare R2** backend and an **Admin Web Panel**.

---

## ✨ Key Features

### 📱 Mobile App (`soultrack-mobile` — Kotlin & Jetpack Compose)
- **Dynamic Album Art Ambient Glow:** Real-time palette extraction via `androidx.palette` and Coil with a breathing radial aura and adaptive mini-player borders.
- **5-Band Equalizer & Bass Boost:** Native Android `AudioFx` (`Equalizer` & `BassBoost`) with curated presets (*Flat, Bass Boost, Vocal, Party, Rock, Acoustic, Classical, Custom*).
- **Sleep Timer:** Configurable countdown (15, 30, 45, 60 mins) and End-of-Track auto-pause.
- **Background Playback & Smart Queue:** Media3 / ExoPlayer foreground service with notification controls, audio caching, and 1-tap cache management.
- **In-App Updater:** Automatic version checks against the backend release API with progress tracking.

### 🖥️ Backend & Admin Panel (`soultrack-server` — Node.js & Express)
- **Cloud-Ready Storage & Database:** Neon PostgreSQL for catalog/playlist management and Cloudflare R2 (or local storage) for fast-start `.m4a` audio & cover artwork.
- **AI Metadata & Artwork Enrichment:** Automatically cleans titles, assigns Genre, Mood, Language, and Composer/Singers via **Groq / Gemini AI**, paired with title-verified **1000×1000 HD iTunes artwork**.
- **Admin Web Dashboard:** Upload audio files, manage playlists, edit track metadata, publish APK releases, and monitor background worker status.
- **Localhost-Only Auto-Discover Bot 🤖:** Search YouTube Music directly from the local admin panel, auto-filter non-song videos/shorts/jukeboxes, deduplicate against the catalog, preview large thumbnails, and confirm before queueing.
- **Resilient Background Worker:** Automatically resumes interrupted `PROCESSING` tracks on server restart, plus CLI tools (`npm run dedupe`, `npm run fix-posters`) for catalog maintenance.

---

## 🛠️ Tech Stack
- **Mobile:** Kotlin, Jetpack Compose, Material 3, Media3 (ExoPlayer), OkHttp, Coil, AndroidX Palette
- **Backend:** Node.js, Express, PostgreSQL (`pg`), AWS SDK v3 (Cloudflare R2), Multer, Helmet
- **Media & AI:** `yt-dlp`, `ffmpeg`, Groq API / Gemini API, iTunes Search API
