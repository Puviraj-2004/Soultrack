import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getPlaylists, createPlaylist, updatePlaylist, deletePlaylist } from '../lib/playlists'

const LibraryContext = createContext(null)

export function LibraryProvider({ children }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getPlaylists()
      setPlaylists(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlaylists()
  }, [fetchPlaylists])

  async function addPlaylist(payload) {
    const newPlaylist = await createPlaylist(payload)
    setPlaylists(p => [newPlaylist, ...p])
    return newPlaylist
  }

  async function editPlaylist(id, updates) {
    const updated = await updatePlaylist(id, updates)
    setPlaylists(p => p.map(pl => pl.id === id ? updated : pl))
  }

  async function removePlaylist(id) {
    await deletePlaylist(id)
    setPlaylists(p => p.filter(pl => pl.id !== id))
  }

  return (
    <LibraryContext.Provider value={{
      playlists, loading,
      addPlaylist, editPlaylist, removePlaylist,
      fetchPlaylists
    }}>
      {children}
    </LibraryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLibrary() {
  return useContext(LibraryContext)
}