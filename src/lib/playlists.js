import { supabase } from './supabase'

// Get all playlists
export async function getPlaylists() {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Create playlist
export async function createPlaylist({ name, description, cover_color }) {
  const { data, error } = await supabase
    .from('playlists')
    .insert([{ name, description, cover_color }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Update playlist
export async function updatePlaylist(id, updates) {
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Delete playlist
export async function deletePlaylist(id) {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
  if (error) throw error
}