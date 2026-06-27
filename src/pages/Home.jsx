import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { getSongs } from '../lib/songs' // songs load seiya
import { APP_CONFIG } from '../data/config'

const COLORS = ['#0096FF', '#FF006E', '#8338EC', '#FB5607', '#06D6A0']

// Dynamic self-contained cover component for Home Screen Grid Cards
function PlaylistCoverHome({ playlist }) {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Custom cover image already irunthaal database fetch seiya thevaiyillai
    if (playlist.cover_image) return

    let isMounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    getSongs(playlist.id)
      .then(data => {
        if (isMounted) {
          setSongs(data || [])
        }
      })
      .catch(err => console.error("Error loading songs for cover:", err))
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [playlist.id, playlist.cover_image])

  // Custom cover image rendering
  if (playlist.cover_image) {
    return (
      <img
        src={playlist.cover_image}
        alt={playlist.name}
        className="w-full h-full object-cover transition-opacity duration-300"
      />
    )
  }

  // Filter songs with valid artwork
  const songsWithArt = songs.filter(s => s.artwork_url)

  if (loading) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center animate-pulse text-[10px] font-bold"
        style={{ color: APP_CONFIG.theme.textMuted, backgroundColor: APP_CONFIG.theme.surface }}
      >
        Loading...
      </div>
    )
  }

  // Fallback A: Empty playlist endral emoji visual
  if (songsWithArt.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-4xl"
        style={{ backgroundColor: playlist.cover_color }}
      >
        🎵
      </div>
    )
  }

  // Fallback B: Songs count 4-kum kammiyaaga irunthaal, single cover view
  if (songsWithArt.length < 4) {
    return (
      <img
        src={songsWithArt[0].artwork_url}
        alt=""
        className="w-full h-full object-cover"
      />
    )
  }

  // Dynamic Spotify Style 2x2 Collage rendering
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden">
      {songsWithArt.slice(0, 4).map((song, idx) => (
        <img
          key={song.id || idx}
          src={song.artwork_url}
          alt=""
          className="w-full h-full object-cover border-[0.5px]"
          style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const { playlists, loading, addPlaylist, editPlaylist, removePlaylist } = useLibrary()
  const navigate = useNavigate()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [form, setForm] = useState({ name: '', cover_color: '#0096FF' })
  const menuRef = useRef(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openCreate() {
    setForm({ name: '', cover_color: '#0096FF' })
    setShowCreate(true)
  }

  function openEdit(pl) {
    setForm({ name: pl.name, cover_color: pl.cover_color })
    setEditTarget(pl)
    setOpenMenuId(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    if (editTarget) {
      await editPlaylist(editTarget.id, form)
      setEditTarget(null)
    } else {
      await addPlaylist(form)
      setShowCreate(false)
    }
    setForm({ name: '', cover_color: '#0096FF' })
  }

  async function handleDelete() {
    await removePlaylist(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <p className="text-xs mb-1 font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
          {APP_CONFIG.couple.person1} & {APP_CONFIG.couple.person2}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: APP_CONFIG.theme.primary }}>
          {APP_CONFIG.name}
        </h1>
        <p className="text-sm mt-1.5 font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>{APP_CONFIG.tagline}</p>
      </div>

      {/* Playlists Grid */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: APP_CONFIG.theme.text }}>Your Playlists</h2>
          <button
            onClick={openCreate}
            className="text-xs px-4 py-2 rounded-full font-bold shadow-md transition-transform active:scale-95"
            style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
          >
            + New Playlist
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Loading playlists...</div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-16 border rounded-2xl bg-gray-50 border-dashed" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <p className="text-5xl mb-4">🎵</p>
            <p className="font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>No playlists yet</p>
            <p className="text-xs mt-1 font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>Create your first playlist!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {playlists.map(pl => (
              <div
                key={pl.id}
                className="rounded-2xl overflow-hidden relative border shadow-sm transition-all hover:shadow-md"
                style={{ backgroundColor: APP_CONFIG.theme.surface, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                {/* Dynamic Cover Section */}
                <div
                  className="w-full h-32 cursor-pointer relative overflow-hidden border-b"
                  style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
                  onClick={() => navigate(`/playlist/${pl.id}`)}
                >
                  <PlaylistCoverHome playlist={pl} />
                </div>

                {/* Info row */}
                <div className="px-3 py-2.5 flex items-center justify-between bg-white">
                  <p
                    className="font-bold text-sm truncate flex-1 cursor-pointer"
                    style={{ color: APP_CONFIG.theme.text }}
                    onClick={() => navigate(`/playlist/${pl.id}`)}
                  >
                    {pl.name}
                  </p>

                  {/* 3 dots */}
                  <div className="relative" ref={openMenuId === pl.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === pl.id ? null : pl.id)
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full ml-1 hover:bg-gray-100 transition-colors"
                      style={{ color: APP_CONFIG.theme.textMuted }}
                    >
                      ⋮
                    </button>

                    {openMenuId === pl.id && (
                      <div
                        className="absolute right-0 bottom-8 rounded-xl overflow-hidden z-20 w-28 shadow-xl border bg-white"
                        style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
                      >
                        <button
                          onClick={() => openEdit(pl)}
                          className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-gray-50"
                          style={{ color: APP_CONFIG.theme.text }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(pl); setOpenMenuId(null) }}
                          className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-red-50 border-t"
                          style={{ color: '#FF006E', borderColor: APP_CONFIG.theme.surfaceHover }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(showCreate || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-3xl p-6 border shadow-2xl bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: APP_CONFIG.theme.text }}>
              {editTarget ? 'Edit Playlist' : 'New Playlist'}
            </h3>
            <input
              className="w-full rounded-xl px-4 py-3 mb-4 text-sm outline-none border focus:ring-1"
              style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
              placeholder="Playlist name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <p className="text-xs mb-2 font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Cover Color</p>
            <div className="flex gap-3 mb-6">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, cover_color: c }))}
                  className="w-8 h-8 rounded-full shadow-inner"
                  style={{
                    backgroundColor: c,
                    border: `2px solid ${form.cover_color === c ? '#000000' : 'transparent'}`
                  }}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(false); setEditTarget(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50"
                style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
              >
                {editTarget ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: APP_CONFIG.theme.text }}>Delete Playlist?</h3>
            <p className="text-sm mb-6" style={{ color: APP_CONFIG.theme.textMuted }}>
              "{deleteTarget.name}" and all its songs will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50"
                style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: '#FF006E', color: '#fff' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}