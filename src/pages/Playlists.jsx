import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { getSongs } from '../lib/songs'
import { APP_CONFIG } from '../data/config'

const COLORS = ['#0096FF', '#FF006E', '#8338EC', '#FB5607', '#06D6A0']

function PlaylistCover({ playlist }) {
  const [songs, setSongs] = useState([])

  useEffect(() => {
    if (playlist.cover_image) return
    let isMounted = true

    getSongs(playlist.id)
      .then(data => {
        if (isMounted) setSongs(data || [])
      })
      .catch(err => console.error('Error loading songs for cover:', err))

    return () => {
      isMounted = false
    }
  }, [playlist.id, playlist.cover_image])

  if (playlist.cover_image) {
    return <img src={playlist.cover_image} alt={playlist.name} className="h-full w-full object-cover" />
  }

  const songsWithArt = songs.filter(song => song.artwork_url)

  if (songsWithArt.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-4xl" style={{ backgroundColor: playlist.cover_color }}>
        <span>♪</span>
      </div>
    )
  }

  if (songsWithArt.length < 4) {
    return <img src={songsWithArt[0].artwork_url} alt="" className="h-full w-full object-cover" />
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 overflow-hidden">
      {songsWithArt.slice(0, 4).map((song, idx) => (
        <img key={song.id || idx} src={song.artwork_url} alt="" className="h-full w-full object-cover" />
      ))}
    </div>
  )
}

export default function Playlists() {
  const { playlists, loading, addPlaylist, editPlaylist, removePlaylist } = useLibrary()
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [form, setForm] = useState({ name: '', cover_color: '#0096FF' })

  const filteredPlaylists = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return playlists
    return playlists.filter(pl => pl.name?.toLowerCase().includes(needle))
  }, [playlists, query])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
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
    <div className="min-h-screen pb-40" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>
      <div className="px-6 pt-10 pb-5">
        <p className="text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
          Your collections
        </p>
        <h1 className="mt-1 text-3xl font-extrabold" style={{ color: APP_CONFIG.theme.primary }}>
          Playlists
        </h1>
        <div className="mt-5 flex gap-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search playlists"
            className="min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold outline-none"
            style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover }}
          />
          <button
            onClick={openCreate}
            className="rounded-2xl px-4 py-3 text-sm font-bold shadow active:scale-95"
            style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
          >
            New
          </button>
        </div>
      </div>

      <div className="px-6">
        {loading ? (
          <div className="py-20 text-center text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Loading playlists...</div>
        ) : filteredPlaylists.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-gray-50 py-16 text-center" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <p className="text-4xl">♪</p>
            <p className="mt-3 font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>No playlists found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredPlaylists.map(pl => (
              <div key={pl.id} className="relative overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
                <div className="h-32 cursor-pointer overflow-hidden border-b" style={{ borderColor: APP_CONFIG.theme.surfaceHover }} onClick={() => navigate(`/playlist/${pl.id}`)}>
                  <PlaylistCover playlist={pl} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <p className="min-w-0 flex-1 cursor-pointer truncate text-sm font-bold" onClick={() => navigate(`/playlist/${pl.id}`)}>
                    {pl.name}
                  </p>
                  <div className="relative" ref={openMenuId === pl.id ? menuRef : null}>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === pl.id ? null : pl.id)
                      }}
                      className="ml-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                      style={{ color: APP_CONFIG.theme.textMuted }}
                    >
                      ⋮
                    </button>
                    {openMenuId === pl.id && (
                      <div className="absolute bottom-9 right-0 z-20 w-28 overflow-hidden rounded-xl border bg-white shadow-xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
                        <button onClick={() => openEdit(pl)} className="w-full px-4 py-3 text-left text-xs font-semibold hover:bg-gray-50">Edit</button>
                        <button onClick={() => { setDeleteTarget(pl); setOpenMenuId(null) }} className="w-full border-t px-4 py-3 text-left text-xs font-semibold hover:bg-red-50" style={{ color: '#FF006E', borderColor: APP_CONFIG.theme.surfaceHover }}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showCreate || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-3xl border bg-white p-6 shadow-2xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="mb-4 text-lg font-bold">{editTarget ? 'Edit Playlist' : 'New Playlist'}</h3>
            <input
              className="mb-4 w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover }}
              placeholder="Playlist name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <p className="mb-2 text-xs font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Cover Color</p>
            <div className="mb-6 flex gap-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, cover_color: c }))}
                  className="h-8 w-8 rounded-full shadow-inner"
                  style={{ backgroundColor: c, border: `2px solid ${form.cover_color === c ? '#000' : 'transparent'}` }}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setEditTarget(null) }} className="flex-1 rounded-xl border py-3 text-sm font-bold" style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}>Cancel</button>
              <button onClick={handleSubmit} className="flex-1 rounded-xl py-3 text-sm font-bold shadow" style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}>{editTarget ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-3xl border bg-white p-6 shadow-2xl" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="mb-2 text-lg font-bold">Delete Playlist?</h3>
            <p className="mb-6 text-sm" style={{ color: APP_CONFIG.theme.textMuted }}>"{deleteTarget.name}" will be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border py-3 text-sm font-bold" style={{ color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}>Cancel</button>
              <button onClick={handleDelete} className="flex-1 rounded-xl py-3 text-sm font-bold shadow" style={{ backgroundColor: '#FF006E', color: '#fff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
