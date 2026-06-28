import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { recordSongPlay } from '../lib/songs'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [currentSong, setCurrentSong] = useState(null)
  const [queue, setQueue] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('none')

  const audioRef = useRef(new Audio())
  const queueRef = useRef(queue)
  const currentSongRef = useRef(currentSong)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)
  const isPlayingRef = useRef(isPlaying)
  const shouldAutoPlayRef = useRef(false)

  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { currentSongRef.current = currentSong }, [currentSong])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const handleNext = useCallback(() => {
    const q = queueRef.current
    const cur = currentSongRef.current
    const rep = repeatRef.current
    const shuf = shuffleRef.current

    if (!q.length) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    if (rep === 'one') {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(console.error)
      return
    }

    const idx = q.findIndex(s => s.id === cur?.id)
    const nextIdx = shuf ? Math.floor(Math.random() * q.length) : Math.max(idx, 0) + 1

    if (nextIdx < q.length) {
      shouldAutoPlayRef.current = true
      setCurrentSong(q[nextIdx])
    } else if (rep === 'all') {
      shouldAutoPlayRef.current = true
      setCurrentSong(q[0])
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
      shouldAutoPlayRef.current = false
    }
  }, [])

  const handlePrev = useCallback(() => {
    const audio = audioRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const q = queueRef.current
    const cur = currentSongRef.current
    const idx = q.findIndex(s => s.id === cur?.id)
    if (idx > 0) {
      shouldAutoPlayRef.current = true
      setCurrentSong(q[idx - 1])
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (isPlayingRef.current) {
      audio.pause()
      setIsPlaying(false)
    } else {
      shouldAutoPlayRef.current = true
      audio.play().catch(console.error)
    }
  }, [])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    const onLoadStart = () => {
      setCurrentTime(0)
      setDuration(0)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration)
    const onEnded = () => handleNext()
    const onError = () => {
      console.error('Audio failed to play:', currentSongRef.current?.title || audio.src)
      handleNext()
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => {
      if (!audio.ended) setIsPlaying(false)
    }

    audio.addEventListener('loadstart', onLoadStart)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('loadstart', onLoadStart)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [handleNext])

  // Load new song
  useEffect(() => {
    if (!currentSong) return
    const audio = audioRef.current
    audio.src = currentSong.cloudinary_url
    audio.load()
    recordSongPlay(currentSong)
    if (shouldAutoPlayRef.current) {
      audio.play().catch(console.error)
    }
  }, [currentSong])

  // Volume
  useEffect(() => {
    audioRef.current.volume = volume
  }, [volume])

  function playSong(song, songQueue = []) {
    shouldAutoPlayRef.current = true
    setQueue(songQueue.length > 0 ? songQueue : [song])
    setCurrentSong(song)
  }

  function closePlayer() {
    const audio = audioRef.current
    shouldAutoPlayRef.current = false
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    setCurrentSong(null)
    setQueue([])
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }

  function seek(time) {
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  function toggleShuffle() { setShuffle(p => !p) }
  function toggleRepeat() {
    setRepeat(p => p === 'none' ? 'all' : p === 'all' ? 'one' : 'none')
  }

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, currentTime, duration,
      volume, shuffle, repeat, queue,
      playSong, togglePlay, handleNext, handlePrev,
      closePlayer, seek, setVolume, toggleShuffle, toggleRepeat
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer() {
  return useContext(PlayerContext)
}
