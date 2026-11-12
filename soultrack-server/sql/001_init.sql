-- Soultrack shared catalog schema (PostgreSQL - optimized for Neon DB)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS songs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type       TEXT NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'youtube', 'url')),
  youtube_id        TEXT UNIQUE,
  title             TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  artist            TEXT NOT NULL DEFAULT 'Unknown Artist' CHECK (char_length(artist) <= 200),
  duration_seconds  INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  audio_url         TEXT NOT NULL DEFAULT '',
  audio_key         TEXT,
  thumbnail_url     TEXT,
  thumbnail_key     TEXT,
  status            TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('PROCESSING', 'READY', 'FAILED')),
  error_message     TEXT,
  play_count        INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  last_played_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT songs_ready_has_audio CHECK (status <> 'READY' OR char_length(trim(audio_url)) > 0)
);

CREATE TABLE IF NOT EXISTS playlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description  TEXT,
  cover_color  TEXT NOT NULL DEFAULT '#0096FF' CHECK (cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  cover_image  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id  UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id      UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS app_releases (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version_code  INTEGER NOT NULL CHECK (version_code >= 1),
  version_name  TEXT NOT NULL CHECK (char_length(trim(version_name)) BETWEEN 1 AND 50),
  download_url  TEXT NOT NULL CHECK (download_url ~ '^https?://'),
  release_notes TEXT NOT NULL DEFAULT '',
  force_update  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_songs_status_created ON songs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_play_count ON songs (play_count DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs (song_id);

-- Real music metadata columns (idempotent for existing Neon/Postgres databases)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS mood TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS album TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_songs_tags ON songs USING GIN (tags);
