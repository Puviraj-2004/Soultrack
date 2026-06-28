import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { addSong, addSongToPlaylist, deleteSong, getAllSongs, getSongPlaylistIds, removeSongFromPlaylist } from '../lib/songs'
import { fetchSongMetadata } from '../lib/itunes'
import { uploadSongFile } from '../lib/storage'
import { APP_CONFIG } from '../data/config'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function extractTitleFromFile(name) {
  const withoutExt = name.replace(/\.[^/.]+$/, '')
  const clean = withoutExt
    .replace(/[_-]/g, ' ')
    .replace(/MP3.*/i, '')
    .replace(/\d{3}K.*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Unknown Song'
}

function SongArtwork({ song, size = 'h-14 w-14' }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-xl border bg-white`} style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
      {song.artwork_url ? (
        <img src={song.artwork_url} alt={song.title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-bold" style={{ color: APP_CONFIG.theme.primary, backgroundColor: APP_CONFIG.theme.accent }}>
          ♪
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { playlists } = useLibrary()
  const { playSong } = usePlayer()

  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [songFile, setSongFile] = useState(null)
  const [titleInput, setTitleInput] = useState('')
  const [artistInput, setArtistInput] = useState('Unknown Artist')
  const [artworkUrlInput, setArtworkUrlInput] = useState('')
  const [durationInput, setDurationInput] = useState(0)
  const [fetchingDetails, setFetchingDetails] = useState(false)
  const [adding, setAdding] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [addError, setAddError] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [playlistSong, setPlaylistSong] = useState(null)
  const [songPlaylistIds, setSongPlaylistIds] = useState([])
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const filteredSongs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return songs

    return songs.filter(song => {
      return `${song.title || ''} ${song.artist || ''}`.toLowerCase().includes(needle)
    })
  }, [songs, query])

  const recentSongs = useMemo(() => filteredSongs.slice(0, 9), [filteredSongs])
  const frequentSongs = useMemo(() => {
    return [...filteredSongs]
      .filter(song => Number(song.play_count) > 0 || song.last_played_at)
      .sort((a, b) => (Number(b.play_count) || 0) - (Number(a.play_count) || 0))
      .slice(0, 9)
  }, [filteredSongs])

  async function fetchSongs() {
    try {
      setLoading(true)
      const data = await getAllSongs()
      setSongs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSongs()
  }, [])

  function resetAddForm() {
    setSongFile(null)
    setTitleInput('')
    setArtistInput('Unknown Artist')
    setArtworkUrlInput('')
    setDurationInput(0)
    setUploadProgress(0)
    setAddError('')
  }

  function handleSongFileChange(file) {
    setSongFile(file || null)
    setAddError('')
  }

  useEffect(() => {
    if (!songFile) return

    let objectUrl
    let cancelled = false

    async function loadFileDetails() {
      setFetchingDetails(true)
      const extractedTitle = extractTitleFromFile(songFile.name)
      setTitleInput(extractedTitle)

      const meta = await fetchSongMetadata(extractedTitle)
      if (!cancelled) {
        if (meta) {
          setArtworkUrlInput(meta.artworkUrl)
          setArtistInput(meta.artistName)
        } else {
          setArtworkUrlInput('')
          setArtistInput('Unknown Artist')
        }
      }

      objectUrl = URL.createObjectURL(songFile)
      const audio = new Audio(objectUrl)
      audio.addEventListener('loadedmetadata', () => {
        if (!cancelled) setDurationInput(Math.round(audio.duration))
        URL.revokeObjectURL(objectUrl)
      })
      audio.addEventListener('error', () => {
        if (!cancelled) setDurationInput(180)
        URL.revokeObjectURL(objectUrl)
      })

      if (!cancelled) setFetchingDetails(false)
    }

    loadFileDetails()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [songFile])

  async function handleAddSong() {
    if (!songFile) return

    setAdding(true)
    setUploadProgress(0)
    setAddError('')
    try {
      const songUrl = await uploadSongFile(songFile, 'library', setUploadProgress)
      const newSong = await addSong({
        title: titleInput || 'Unknown Title',
        artist: artistInput || 'Unknown Artist',
        cloudinary_url: songUrl,
        artwork_url: artworkUrlInput || null,
        duration: durationInput || 0,
      })

      setSongs(current => [newSong, ...current])
      resetAddForm()
      setShowAdd(false)
    } catch (err) {
      console.error(err)
      setAddError(err.message || 'Song upload failed. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  async function openPlaylistPicker(song) {
    setPlaylistSong(song)
    setOpenMenuId(null)
    setAssignError('')
    try {
      const ids = await getSongPlaylistIds(song.id)
      setSongPlaylistIds(ids)
    } catch (err) {
      console.error(err)
      setAssignError(err.message || 'Could not load playlists for this song.')
    }
  }

  async function handleAssignToPlaylist(playlistId) {
    if (!playlistSong) return

    setAssigning(true)
    setAssignError('')
    try {
      if (songPlaylistIds.includes(playlistId)) {
        await removeSongFromPlaylist(playlistSong.id, playlistId)
        setSongPlaylistIds(ids => ids.filter(id => id !== playlistId))
      } else {
        await addSongToPlaylist(playlistSong.id, playlistId)
        setSongPlaylistIds(ids => [...new Set([...ids, playlistId])])
      }
    } catch (err) {
      console.error(err)
      setAssignError(err.message || 'Could not update playlists.')
    } finally {
      setAssigning(false)
    }
  }

  function openDeleteConfirm(song) {
    setDeleteTarget(song)
    setOpenMenuId(null)
  }

  async function handleDeleteSong() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await deleteSong(deleteTarget.id)
      setSongs(current => current.filter(item => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  function handlePlay(song) {
    playSong(song, filteredSongs)
  }

  function renderSongTile(song) {
    return (
      <button
        key={song.id}
        onClick={() => handlePlay(song)}
        className="min-w-0 rounded-2xl border bg-white p-2 text-left shadow-sm transition active:scale-[0.99]"
        style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
      >
        <SongArtwork song={song} size="aspect-square w-full" />
        <span className="mt-2 block min-w-0">
          <span className="block truncate text-xs font-bold">{song.title}</span>
          <span className="mt-1 block truncate text-[11px] font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
            {song.artist || 'Unknown Artist'}
          </span>
        </span>
      </button>
    )
  }

  function renderSongRow(song) {
    const isOpen = openMenuId === song.id

    return (
      <div key={song.id} className="relative flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
        <button onClick={() => handlePlay(song)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <SongArtwork song={song} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{song.title}</span>
            <span className="mt-1 block truncate text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
              {song.artist || 'Unknown Artist'} · {formatTime(song.duration)}
            </span>
          </span>
        </button>

        <button
          onClick={() => setOpenMenuId(isOpen ? null : song.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100"
          style={{ color: APP_CONFIG.theme.textMuted }}
        >
          ⋮
        </button>

        {isOpen && (
          <div className="absolute right-3 top-14 z-20 w-40 overflow-hidden rounded-xl border bg-white p-1 shadow-xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <button onClick={() => { handlePlay(song); setOpenMenuId(null) }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50">Play</button>
            <button onClick={() => openPlaylistPicker(song)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50">Manage playlists</button>
            <button onClick={() => openDeleteConfirm(song)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-red-50" style={{ color: '#FF006E' }}>Delete song</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-44" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
      <div className="px-6 pt-10 pb-5">
        <p className="text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
          {APP_CONFIG.couple.person1} & {APP_CONFIG.couple.person2}
        </p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-4xl font-extrabold" style={{ color: APP_CONFIG.theme.primary }}>
              {APP_CONFIG.name}
            </h1>
            <p className="mt-1 text-sm font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>{APP_CONFIG.tagline}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="shrink-0 rounded-2xl px-4 py-3 text-sm font-bold shadow active:scale-95"
            style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="px-6 pb-5">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search songs or artists"
          className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none"
          style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover }}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Loading songs...</div>
      ) : songs.length === 0 ? (
        <div className="mx-6 rounded-3xl border border-dashed bg-gray-50 px-6 py-16 text-center" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
          <p className="text-5xl">♪</p>
          <p className="mt-4 font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Your library is empty</p>
          <button onClick={() => setShowAdd(true)} className="mt-5 rounded-2xl px-5 py-3 text-sm font-bold" style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}>Upload first song</button>
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="mx-6 rounded-3xl border border-dashed bg-gray-50 px-6 py-14 text-center" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
          <p className="text-4xl">⌕</p>
          <p className="mt-4 font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>No songs found</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Try another title or artist.</p>
        </div>
      ) : (
        <div className="space-y-8 px-6">
          <section>
            <h2 className="mb-3 text-lg font-bold">Recently added</h2>
            <div className="grid grid-cols-3 gap-3">
              {recentSongs.map(renderSongTile)}
            </div>
          </section>

          {frequentSongs.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Frequent songs</h2>
              <div className="grid grid-cols-3 gap-3">
                {frequentSongs.map(renderSongTile)}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold">All songs</h2>
            <div className="flex flex-col gap-2">
              {filteredSongs.map(renderSongRow)}
            </div>
          </section>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bottom-sheet flex w-full max-w-md flex-col rounded-3xl border bg-white p-6 shadow-2xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="mb-4 text-lg font-bold">Add Song</h3>

            <div className="mb-5 flex items-center gap-4 rounded-2xl border p-3" style={{ backgroundColor: APP_CONFIG.theme.surface, borderColor: APP_CONFIG.theme.surfaceHover }}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
                {fetchingDetails ? (
                  <span className="text-xs font-semibold animate-pulse" style={{ color: APP_CONFIG.theme.textMuted }}>...</span>
                ) : artworkUrlInput ? (
                  <img src={artworkUrlInput} alt="art" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">♪</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="max-w-60 truncate text-sm font-bold">{titleInput || 'New Song Track'}</p>
                <p className="mt-1 max-w-60 truncate text-xs font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>
                  {fetchingDetails ? 'Syncing details...' : `${artistInput} · ${formatTime(durationInput)}`}
                </p>
              </div>
            </div>

            <div className="bottom-sheet-scroll mb-4 flex flex-col gap-4 overflow-y-auto pr-1">
              <div>
                <label className="mb-1.5 block text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Upload Audio File</label>
                <label className="block w-full cursor-pointer rounded-xl border bg-white px-3 py-3 text-sm font-semibold" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
                  <input type="file" accept="audio/*" className="hidden" onChange={e => handleSongFileChange(e.target.files?.[0] || null)} />
                  {songFile ? songFile.name : 'Choose song from device'}
                </label>
              </div>

              <input className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: APP_CONFIG.theme.surfaceHover }} placeholder="Song Title" value={titleInput} onChange={e => setTitleInput(e.target.value)} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: APP_CONFIG.theme.surfaceHover }} placeholder="Artist" value={artistInput} onChange={e => setArtistInput(e.target.value)} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: APP_CONFIG.theme.surfaceHover }} placeholder="Artwork image link" value={artworkUrlInput} onChange={e => setArtworkUrlInput(e.target.value)} />

              {adding && (
                <div>
                  <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>
                    <span>Uploading</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: APP_CONFIG.theme.surfaceHover }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, backgroundColor: APP_CONFIG.theme.primary }} />
                  </div>
                </div>
              )}

              {addError && <p className="text-xs font-semibold" style={{ color: '#FF006E' }}>{addError}</p>}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t bg-white pt-4" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
              <button onClick={() => { setShowAdd(false); resetAddForm() }} className="flex-1 rounded-xl border py-3 text-sm font-bold" style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}>Cancel</button>
              <button onClick={handleAddSong} disabled={adding || !songFile} className="flex-1 rounded-xl py-3 text-sm font-bold shadow disabled:opacity-50" style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}>{adding ? 'Uploading...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {playlistSong && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-3xl border bg-white p-6 shadow-2xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold">Manage playlists</h3>
            <p className="mb-5 mt-1 truncate text-sm" style={{ color: APP_CONFIG.theme.textMuted }}>{playlistSong.title}</p>

            <div className="mb-5 flex max-h-72 flex-col gap-2 overflow-y-auto">
              {playlists.length === 0 ? (
                <div className="rounded-2xl border py-6 text-center text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}>Create a playlist first.</div>
              ) : (
                playlists.map(pl => {
                  const alreadyAdded = songPlaylistIds.includes(pl.id)
                  return (
                    <button
                      key={pl.id}
                      onClick={() => handleAssignToPlaylist(pl.id)}
                      disabled={assigning}
                      className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left disabled:opacity-55"
                      style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
                    >
                      <span className="h-10 w-10 shrink-0 rounded-xl" style={{ backgroundColor: pl.cover_color || APP_CONFIG.theme.primary }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{pl.name}</span>
                        <span className="mt-0.5 block text-xs font-semibold" style={{ color: alreadyAdded ? APP_CONFIG.theme.primary : APP_CONFIG.theme.textMuted }}>
                          {alreadyAdded ? 'Tap to remove' : 'Tap to add'}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold" style={{ color: alreadyAdded ? '#FF006E' : APP_CONFIG.theme.primary }}>
                        {alreadyAdded ? 'Remove' : 'Add'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {assignError && <p className="mb-4 text-xs font-semibold" style={{ color: '#FF006E' }}>{assignError}</p>}

            <button onClick={() => setPlaylistSong(null)} disabled={assigning} className="w-full rounded-xl border py-3 text-sm font-bold disabled:opacity-50" style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}>
              Done
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-3xl border bg-white p-6 shadow-2xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="mb-2 text-lg font-bold">Delete Song?</h3>
            <p className="mb-6 text-sm" style={{ color: APP_CONFIG.theme.textMuted }}>
              "{deleteTarget.title}" will be removed from your library and every playlist. The Cloudinary file will stay stored.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border py-3 text-sm font-bold disabled:opacity-50"
                style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSong}
                disabled={deleting}
                className="flex-1 rounded-xl py-3 text-sm font-bold shadow disabled:opacity-50"
                style={{ backgroundColor: '#FF006E', color: '#fff' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
