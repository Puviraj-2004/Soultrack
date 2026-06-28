import { supabase } from './supabase'

export async function getAllSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
  if (error) throw error
  return (data || []).sort((a, b) => {
    if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at)
    if (a.last_played_at && b.last_played_at) return new Date(b.last_played_at) - new Date(a.last_played_at)
    return (a.title || '').localeCompare(b.title || '')
  })
}

// Get songs by playlist
export async function getSongs(playlist_id) {
  const { data, error } = await supabase
    .from('playlist_songs')
    .select('position, songs(*)')
    .eq('playlist_id', playlist_id)
    .order('position', { ascending: true })

  if (error) throw error
  return (data || [])
    .map(row => row.songs ? { ...row.songs, playlist_position: row.position } : null)
    .filter(Boolean)
}

// Add song - Including artwork_url
export async function addSong({ playlist_id, title, artist, cloudinary_url, artwork_url, duration, position }) {
  const payload = { title, artist, cloudinary_url, artwork_url, duration }

  if (playlist_id) payload.playlist_id = playlist_id
  if (Number.isFinite(position)) payload.position = position

  const { data, error } = await supabase
    .from('songs')
    .insert([payload])
    .select()
    .single()
  if (error) throw error

  if (playlist_id) {
    await addSongToPlaylist(data.id, playlist_id, position)
  }

  return data
}

// Delete song
export async function deleteSong(id) {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function addSongToPlaylist(songId, playlistId, position) {
  let nextPosition = position

  if (!Number.isFinite(nextPosition)) {
    const { data: lastSong, error: positionError } = await supabase
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (positionError) throw positionError

    nextPosition = Number.isFinite(lastSong?.position) ? lastSong.position + 1 : 0
  }

  const { data, error } = await supabase
    .from('playlist_songs')
    .upsert(
      [{ playlist_id: playlistId, song_id: songId, position: nextPosition }],
      { onConflict: 'playlist_id,song_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removeSongFromPlaylist(songId, playlistId) {
  const { error } = await supabase
    .from('playlist_songs')
    .delete()
    .eq('song_id', songId)
    .eq('playlist_id', playlistId)
  if (error) throw error
}

export async function getSongPlaylistIds(songId) {
  const { data, error } = await supabase
    .from('playlist_songs')
    .select('playlist_id')
    .eq('song_id', songId)
  if (error) throw error
  return (data || []).map(row => row.playlist_id)
}

export async function recordSongPlay(song) {
  const nextPlayCount = Number.isFinite(song?.play_count) ? song.play_count + 1 : 1

  const { error } = await supabase
    .from('songs')
    .update({
      play_count: nextPlayCount,
      last_played_at: new Date().toISOString(),
    })
    .eq('id', song.id)

  if (error) console.error(error)
}

export async function moveSongToPlaylist(songId, playlistId, currentPlaylistId) {
  const { data: lastSong, error: positionError } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (positionError) throw positionError

  const nextPosition = Number.isFinite(lastSong?.position) ? lastSong.position + 1 : 0

  const data = await addSongToPlaylist(songId, playlistId, nextPosition)
  if (currentPlaylistId) await removeSongFromPlaylist(songId, currentPlaylistId)
  return data
}
