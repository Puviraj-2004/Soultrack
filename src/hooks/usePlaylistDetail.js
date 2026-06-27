// src/hooks/usePlaylistDetail.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { getSongs, addSong, deleteSong } from '../lib/songs'
import { fetchSongMetadata } from '../lib/itunes'

export function extractTitleFromUrl(url) {
  try {
    const filename = url.split('/').pop().split('?')[0]
    const withoutExt = filename.replace(/\.[^/.]+$/, '')
    const clean = withoutExt
      .replace(/[_-]/g, ' ')
      .replace(/MP3.*/i, '')
      .replace(/\d{3}K.*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    return clean.charAt(0).toUpperCase() + clean.slice(1)
  } catch {
    return 'Unknown Song'
  }
}

export function usePlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { playlists, editPlaylist, removePlaylist } = useLibrary()
  const { playSong, currentSong, isPlaying, togglePlay } = usePlayer()

  const playlist = playlists.find(p => p.id === id)

  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditPlaylist, setShowEditPlaylist] = useState(false)
  const [showDeletePlaylist, setShowDeletePlaylist] = useState(false)
  const [playlistForm, setPlaylistForm] = useState({ name: '', cover_color: '' })
  
  // Form input states
  const [cloudinaryUrl, setCloudinaryUrl] = useState('')
  const [titleInput, setTitleInput] = useState('')
  const [artistInput, setArtistInput] = useState('Unknown Artist')
  const [artworkUrlInput, setArtworkUrlInput] = useState('')
  const [durationInput, setDurationInput] = useState(0)

  const [adding, setAdding] = useState(false)
  const [fetchingArt, setFetchingArt] = useState(false)
  const [activeSongDropdownId, setActiveSongDropdownId] = useState(null)

  const menuRef = useRef(null)

  // Outside click menu close logic
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSongs = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getSongs(id)
      setSongs(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) fetchSongs()
  }, [id, fetchSongs])

  // Automated metadata & duration fetcher [1]
  useEffect(() => {
    if (!cloudinaryUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitleInput('')
      setArtworkUrlInput('')
      setArtistInput('Unknown Artist')
      setDurationInput(0)
      return
    }

    const timer = setTimeout(async () => {
      setFetchingArt(true)
      const extractedTitle = extractTitleFromUrl(cloudinaryUrl)
      setTitleInput(extractedTitle)
      
      const meta = await fetchSongMetadata(extractedTitle)
      if (meta) {
        setArtworkUrlInput(meta.artworkUrl)
        setArtistInput(meta.artistName)
      } else {
        setArtworkUrlInput('')
        setArtistInput('Unknown Artist')
      }

      const audio = new Audio(cloudinaryUrl)
      audio.addEventListener('loadedmetadata', () => {
        setDurationInput(Math.round(audio.duration))
      })
      audio.addEventListener('error', () => {
        setDurationInput(180) // default 3 mins
      })

      setFetchingArt(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [cloudinaryUrl])

  async function handleAddSong() {
    if (!cloudinaryUrl.trim()) return
    setAdding(true)
    try {
      const newSong = await addSong({
        playlist_id: id,
        title: titleInput || 'Unknown Title',
        artist: artistInput || 'Unknown Artist',
        cloudinary_url: cloudinaryUrl,
        artwork_url: artworkUrlInput || null,
        duration: durationInput || 0,
        position: songs.length
      })
      
      setSongs(s => [...s, newSong])
      setCloudinaryUrl('')
      setTitleInput('')
      setArtworkUrlInput('')
      setArtistInput('Unknown Artist')
      setDurationInput(0)
      setShowAdd(false)
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteSong() {
    await deleteSong(deleteTarget.id)
    setSongs(s => s.filter(sg => sg.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function handleEditPlaylist() {
    await editPlaylist(id, playlistForm)
    setShowEditPlaylist(false)
  }

  async function handleDeletePlaylist() {
    await removePlaylist(id)
    navigate('/')
  }

  const toggleDropdown = (e, songId) => {
    e.stopPropagation()
    setActiveSongDropdownId(activeSongDropdownId === songId ? null : songId)
  }

  const handleRowClick = (song) => {
    playSong(song, songs)
  }

  return {
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
    setActiveSongDropdownId,
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
  }
}