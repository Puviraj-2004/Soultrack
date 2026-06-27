import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

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
    if (rep === 'one') {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      return
    }
    const idx = q.findIndex(s => s.id === cur?.id)
    const nextIdx = shuf ? Math.floor(Math.random() * q.length) : idx + 1
    if (nextIdx < q.length) {
      setCurrentSong(q[nextIdx])
    } else if (rep === 'all') {
      setCurrentSong(q[0])
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
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
    if (idx > 0) setCurrentSong(q[idx - 1])
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (isPlayingRef.current) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().catch(console.error)
      setIsPlaying(true)
    }
  }, [])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration)
    const onEnded = () => handleNext()
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
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
    audio.play().catch(console.error)
  }, [currentSong])

  // Volume
  useEffect(() => {
    audioRef.current.volume = volume
  }, [volume])

  function playSong(song, songQueue = []) {
    if (songQueue.length > 0) setQueue(songQueue)
    setCurrentSong(song)
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
      seek, setVolume, toggleShuffle, toggleRepeat
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer() {
  return useContext(PlayerContext)
}