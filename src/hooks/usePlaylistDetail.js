// src/hooks/usePlaylistDetail.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { getSongs, addSong, addSongToPlaylist, removeSongFromPlaylist } from '../lib/songs'
import { fetchSongMetadata } from '../lib/itunes'
import { uploadSongFile } from '../lib/storage'

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
  const [moveTarget, setMoveTarget] = useState(null)
  const [movingSong, setMovingSong] = useState(false)
  const [moveError, setMoveError] = useState('')
  
  // Form input states
  const [cloudinaryUrl, setCloudinaryUrl] = useState('')
  const [songFile, setSongFile] = useState(null)
  const [titleInput, setTitleInput] = useState('')
  const [artistInput, setArtistInput] = useState('Unknown Artist')
  const [artworkUrlInput, setArtworkUrlInput] = useState('')
  const [durationInput, setDurationInput] = useState(0)

  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fetchingArt, setFetchingArt] = useState(false)
  const [addError, setAddError] = useState('')
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

  function resetAddForm() {
    setCloudinaryUrl('')
    setSongFile(null)
    setTitleInput('')
    setArtworkUrlInput('')
    setArtistInput('Unknown Artist')
    setDurationInput(0)
    setAddError('')
  }

  function handleSongFileChange(file) {
    setAddError('')
    setSongFile(file || null)
    if (file) setCloudinaryUrl('')
  }

  // Automated metadata & duration fetcher for pasted URLs
  useEffect(() => {
    if (songFile) return

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
  }, [cloudinaryUrl, songFile])

  // Automated metadata & duration fetcher for local uploads
  useEffect(() => {
    if (!songFile) return

    let objectUrl
    let cancelled = false

    async function loadFileDetails() {
      setFetchingArt(true)
      const extractedTitle = extractTitleFromUrl(songFile.name)
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

      if (!cancelled) setFetchingArt(false)
    }

    loadFileDetails()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [songFile])

  async function handleAddSong() {
    if (!songFile && !cloudinaryUrl.trim()) return
    setAdding(true)
    setAddError('')
    try {
      let songUrl = cloudinaryUrl.trim()
      if (songFile) {
        setUploading(true)
        songUrl = await uploadSongFile(songFile, id)
      }

      const newSong = await addSong({
        playlist_id: id,
        title: titleInput || 'Unknown Title',
        artist: artistInput || 'Unknown Artist',
        cloudinary_url: songUrl,
        artwork_url: artworkUrlInput || null,
        duration: durationInput || 0,
        position: songs.length
      })
      
      setSongs(s => [...s, newSong])
      resetAddForm()
      setShowAdd(false)
    } catch (err) {
      console.error(err)
      setAddError(err.message || 'Song upload failed. Please try again.')
    } finally {
      setUploading(false)
      setAdding(false)
    }
  }

  async function handleDeleteSong() {
    await removeSongFromPlaylist(deleteTarget.id, id)
    setSongs(s => s.filter(sg => sg.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  function openMoveSong(song) {
    setMoveTarget(song)
    setMoveError('')
    setActiveSongDropdownId(null)
  }

  async function handleMoveSong(targetPlaylistId) {
    if (!moveTarget || targetPlaylistId === id) return

    setMovingSong(true)
    setMoveError('')
    try {
      await addSongToPlaylist(moveTarget.id, targetPlaylistId)
      setMoveError('Added to playlist.')
    } catch (err) {
      console.error(err)
      setMoveError(err.message || 'Could not add song to playlist.')
    } finally {
      setMovingSong(false)
    }
  }

  async function handleRemoveFromPlaylist(song) {
    await removeSongFromPlaylist(song.id, id)
    setSongs(s => s.filter(sg => sg.id !== song.id))
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
    moveTarget,
    setMoveTarget,
    movingSong,
    moveError,
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
    songFile,
    handleSongFileChange,
    titleInput,
    setTitleInput,
    artistInput,
    setArtistInput,
    artworkUrlInput,
    setArtworkUrlInput,
    durationInput,
    adding,
    uploading,
    fetchingArt,
    addError,
    resetAddForm,
    activeSongDropdownId,
    setActiveSongDropdownId,
    menuRef,
    handleAddSong,
    handleDeleteSong,
    openMoveSong,
    handleMoveSong,
    handleRemoveFromPlaylist,
    handleEditPlaylist,
    handleDeletePlaylist,
    toggleDropdown,
    handleRowClick,
    currentSong,
    playlists,
    isPlaying,
    togglePlay,
    navigate
  }
}
