// src/pages/PlaylistDetail.jsx
import { usePlaylistDetail } from '../hooks/usePlaylistDetail'
import { APP_CONFIG } from '../data/config'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const COLORS = ['#0096FF', '#FF006E', '#8338EC', '#FB5607', '#06D6A0']

function PlaylistCover({ songs, coverImage, fallbackColor }) {
  if (coverImage) {
    return <img src={coverImage} alt="" className="w-full h-full object-cover" />
  }

  const songsWithArt = songs.filter(s => s.artwork_url)

  if (songsWithArt.length === 0) {
    return (
      <div 
        className="w-full h-full flex items-center justify-center text-4xl"
        style={{ backgroundColor: fallbackColor || APP_CONFIG.theme.primary }}
      >
        🎵
      </div>
    )
  }

  if (songsWithArt.length < 4) {
    return (
      <img 
        src={songsWithArt[0].artwork_url} 
        alt="" 
        className="w-full h-full object-cover" 
      />
    )
  }

  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden animate-fadeIn">
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

export default function PlaylistDetail() {
  // logic structures parsed inside the custom hook
  const {
    playlist,
    songs,
    loading,
    showAdd,
    setShowAdd,
    deleteTarget,
    setDeleteTarget,
    showMenu,
    setShowMenu,
    showEditPlaylist,
    setShowEditPlaylist,
    showDeletePlaylist,
    setShowDeletePlaylist,
    playlistForm,
    setPlaylistForm,
    cloudinaryUrl,
    setCloudinaryUrl,
    titleInput,
    setTitleInput,
    artistInput,
    setArtistInput,
    artworkUrlInput,
    setArtworkUrlInput,
    durationInput,
    adding,
    fetchingArt,
    activeSongDropdownId,
    menuRef,
    handleAddSong,
    handleDeleteSong,
    handleEditPlaylist,
    handleDeletePlaylist,
    toggleDropdown,
    handleRowClick,
    currentSong,
    isPlaying,
    togglePlay,
    navigate
  } = usePlaylistDetail()

  if (!playlist) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: APP_CONFIG.theme.bg }}>
      <p style={{ color: APP_CONFIG.theme.textMuted }}>Playlist not found</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-36" style={{ backgroundColor: APP_CONFIG.theme.bg, color: APP_CONFIG.theme.text }}>

      {/* Header */}
      <div
        className="px-6 pt-10 pb-8 relative"
        style={{ background: `linear-gradient(180deg, ${playlist.cover_color}22 0%, ${APP_CONFIG.theme.bg} 100%)` }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/')} 
            className="font-semibold transition-colors text-sm hover:text-black"
            style={{ color: APP_CONFIG.theme.textMuted }}
          >
            ← Back
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(m => !m)}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-full transition-colors"
              style={{ color: APP_CONFIG.theme.textMuted }}
            >
              ⋮
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-10 rounded-xl overflow-hidden z-20 w-36 shadow-xl border bg-white"
                style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                <button
                  onClick={() => {
                    setPlaylistForm({ name: playlist.name, cover_color: playlist.cover_color })
                    setShowEditPlaylist(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 font-semibold"
                  style={{ color: APP_CONFIG.theme.text }}
                >
                  ✏️ Edit Playlist
                </button>
                <button
                  onClick={() => { setShowDeletePlaylist(true); setShowMenu(false) }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 font-semibold border-t"
                  style={{ color: '#FF006E', borderColor: APP_CONFIG.theme.surfaceHover }}
                >
                  🗑 Delete Playlist
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Cover image collage */}
        <div
          className="w-36 h-36 rounded-2xl mb-4 mx-auto overflow-hidden shadow-lg border"
          style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
        >
          <PlaylistCover 
            songs={songs} 
            coverImage={playlist.cover_image} 
            fallbackColor={playlist.cover_color} 
          />
        </div>

        <h1 className="text-2xl font-bold text-center" style={{ color: APP_CONFIG.theme.text }}>{playlist.name}</h1>
        <p className="text-xs text-center mt-2 font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
          {songs.length} {songs.length === 1 ? 'song' : 'songs'}
        </p>

        {songs.length > 0 && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => handleRowClick(songs[0])}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95 hover:scale-105"
              style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
            >
              ▶ Play All
            </button>
          </div>
        )}
      </div>

      {/* Songs */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold tracking-wider" style={{ color: APP_CONFIG.theme.textMuted }}>SONGS</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs px-4 py-2 rounded-full font-bold shadow transition-transform active:scale-95"
            style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
          >
            + Add Song
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-sm font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Loading songs...</div>
        ) : songs.length === 0 ? (
          <div className="text-center py-16 border rounded-2xl bg-gray-50 border-dashed" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <p className="text-4xl mb-3">🎶</p>
            <p className="font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>No songs yet</p>
            <p className="text-xs mt-1 font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>Paste a Cloudinary URL to add!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {songs.map((song) => {
              const isActive = currentSong?.id === song.id
              return (
                <div
                  key={song.id}
                  onClick={() => handleRowClick(song)} 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer hover:bg-gray-50 border"
                  style={{
                    backgroundColor: isActive ? APP_CONFIG.theme.accent : APP_CONFIG.theme.surface,
                    borderColor: isActive ? APP_CONFIG.theme.primary : 'transparent'
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl shrink-0 overflow-hidden flex items-center justify-center border bg-white"
                    style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
                  >
                    {song.artwork_url ? (
                      <img src={song.artwork_url} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ fontSize: 20 }}>🎵</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); isActive ? togglePlay() : handleRowClick(song) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-xs shrink-0 transition-transform active:scale-90 shadow"
                    style={{ backgroundColor: isActive ? APP_CONFIG.theme.primary : '#ffffff', color: isActive ? '#fff' : APP_CONFIG.theme.text }}
                  >
                    {isActive && isPlaying ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: isActive ? APP_CONFIG.theme.primary : APP_CONFIG.theme.text }}>
                      {song.title}
                    </p>
                    <p className="text-xs mt-1 font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>
                      {song.artist || 'Unknown Artist'} · {formatTime(song.duration)}
                    </p>
                  </div>

                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(e, song.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                      style={{ color: APP_CONFIG.theme.textMuted }}
                    >
                      ⋮
                    </button>
                    
                    {activeSongDropdownId === song.id && (
                      <>
                        <div className="fixed inset-0 z-10 cursor-default" onClick={(e) => { e.stopPropagation(); toggleDropdown(e, null); }} />
                        <div 
                          className="absolute right-0 mt-2 w-32 rounded-xl border p-1 shadow-xl z-20 bg-white"
                          style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRowClick(song); toggleDropdown(e, null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50 rounded-lg transition-colors text-black"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Play
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(song); toggleDropdown(e, null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-red-50 text-red-600 rounded-lg transition-colors mt-0.5"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Song Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-3xl p-6 shadow-2xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: APP_CONFIG.theme.text }}>Add Song</h3>

            {/* Art Preview Header */}
            <div className="flex items-center gap-4 p-3 rounded-2xl border mb-5" style={{ backgroundColor: APP_CONFIG.theme.surface, borderColor: APP_CONFIG.theme.surfaceHover }}>
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border bg-white"
                style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                {fetchingArt ? (
                  <span style={{ color: APP_CONFIG.theme.textMuted }} className="text-xs font-semibold animate-pulse">...</span>
                ) : artworkUrlInput ? (
                  <img src={artworkUrlInput} alt="art" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontSize: 28 }}>🎵</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate max-w-60" style={{ color: APP_CONFIG.theme.text }}>
                  {titleInput || 'New Song Track'}
                </p>
                <p className="text-xs font-medium mt-1 truncate max-w-60" style={{ color: APP_CONFIG.theme.textMuted }}>
                  {fetchingArt
                    ? 'Syncing details...'
                    : `Artist: ${artistInput} · ${formatTime(durationInput)}`}
                </p>
              </div>
            </div>

            {/* Inputs Form */}
            <div className="flex flex-col gap-4 max-h-75 overflow-y-auto mb-6 pr-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Cloudinary URL *</label>
                <input
                  type="url"
                  required
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none border focus:ring-1 bg-white"
                  style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
                  placeholder="https://res.cloudinary.com/..."
                  value={cloudinaryUrl}
                  onChange={e => setCloudinaryUrl(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Track Title</label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none border focus:ring-1 bg-white"
                  style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
                  placeholder="Song Title"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Artist Name</label>
                <input
                  type="text"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none border focus:ring-1 bg-white"
                  style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
                  placeholder="Artist"
                  value={artistInput}
                  onChange={e => setArtistInput(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold" style={{ color: APP_CONFIG.theme.textMuted }}>Artwork Image URL (Optional)</label>
                <input
                  type="url"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none border focus:ring-1 bg-white"
                  style={{ color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
                  placeholder="Paste artwork cover image link"
                  value={artworkUrlInput}
                  onChange={e => setArtworkUrlInput(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 border-t pt-4" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
              <button
                // eslint-disable-next-line no-undef
                onClick={() => { setShowAdd(false); setCloudinaryUrl(''); setTitleInput(''); setArtworkUrlInput(''); setArtistInput('Unknown Artist'); setDurationInput(0); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50"
                style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSong}
                disabled={adding || !cloudinaryUrl.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95 text-white"
                style={{
                  backgroundColor: APP_CONFIG.theme.primary,
                  opacity: (adding || !cloudinaryUrl.trim()) ? 0.5 : 1
                }}
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Song Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: APP_CONFIG.theme.text }}>Remove Song?</h3>
            <p className="text-sm mb-6" style={{ color: APP_CONFIG.theme.textMuted }}>
              "{deleteTarget.title}" will be removed.
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
                onClick={handleDeleteSong}
                className="flex-1 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: '#FF006E', color: '#fff' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditPlaylist && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-3xl p-6 shadow-2xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: APP_CONFIG.theme.text }}>Edit Playlist</h3>
            <input
              className="w-full rounded-xl px-4 py-3 mb-4 text-sm outline-none border focus:ring-1"
              style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.text, borderColor: APP_CONFIG.theme.surfaceHover, '--tw-ring-color': APP_CONFIG.theme.primary }}
              placeholder="Playlist name *"
              value={playlistForm.name}
              onChange={e => setPlaylistForm(f => ({ ...f, name: e.target.value }))}
            />
            <p className="text-xs mb-2 font-semibold" style={{ color: APP_CONFIG.theme.textMuted }}>Cover Color</p>
            <div className="flex gap-3 mb-6">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPlaylistForm(f => ({ ...f, cover_color: c }))}
                  className="w-8 h-8 rounded-full shadow-inner"
                  style={{
                    backgroundColor: c,
                    border: `2px solid ${playlistForm.cover_color === c ? '#000000' : 'transparent'}`
                  }}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditPlaylist(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50"
                style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditPlaylist}
                className="flex-1 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#fff' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Playlist Modal */}
      {showDeletePlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border bg-white" style={{ borderColor: APP_CONFIG.theme.surfaceHover }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: APP_CONFIG.theme.text }}>Delete Playlist?</h3>
            <p className="text-sm mb-6" style={{ color: APP_CONFIG.theme.textMuted }}>
              "{playlist.name}" and all its songs will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeletePlaylist(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50"
                style={{ backgroundColor: '#ffffff', color: APP_CONFIG.theme.textMuted, borderColor: APP_CONFIG.theme.surfaceHover }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlaylist}
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