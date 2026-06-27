import { supabase } from './supabase'

// Get songs by playlist
export async function getSongs(playlist_id) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('playlist_id', playlist_id)
    .order('position', { ascending: true })
  if (error) throw error
  return data
}

// Add song - Including artwork_url
export async function addSong({ playlist_id, title, artist, cloudinary_url, artwork_url, duration, position }) {
  const { data, error } = await supabase
    .from('songs')
    .insert([{ playlist_id, title, artist, cloudinary_url, artwork_url, duration, position }])
    .select()
    .single()
  if (error) throw error
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