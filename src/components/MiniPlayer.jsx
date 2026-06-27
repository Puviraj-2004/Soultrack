import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { APP_CONFIG } from '../data/config'

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MiniPlayer() {
  const {
    currentSong, isPlaying, currentTime, duration,
    togglePlay, handleNext, handlePrev, seek,
    volume, setVolume, shuffle, repeat,
    toggleShuffle, toggleRepeat
  } = usePlayer()

  const [expanded, setExpanded] = useState(false)

  // Swipe Down to Close Gesture Logic (Mobile friendly)
  const touchStartY = useRef(0)

  const handleTouchStart = (e) => {
    // Interactive components trigger aagatha idathil mattum gesture track seiyum
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    const currentY = e.touches[0].clientY
    const difference = currentY - touchStartY.current

    // Downward swipe 120px threshold value reach aanal close trigger aagum
    if (difference > 120) {
      setExpanded(false)
    }
  }

  // Prevent input range drag conflict (Slider drag pannumpothu player close aagathiruka)
  const preventSliderGesture = (e) => {
    e.stopPropagation()
  }

  // Media Session API
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist || 'Unknown Artist',
      album: APP_CONFIG.name,
      artwork: currentSong.artwork_url ? [{ src: currentSong.artwork_url, sizes: '512x512', type: 'image/png' }] : []
    })
    navigator.mediaSession.setActionHandler('play', togglePlay)
    navigator.mediaSession.setActionHandler('pause', togglePlay)
    navigator.mediaSession.setActionHandler('nexttrack', handleNext)
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime)
    })
    return () => {
      ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto'].forEach(action => {
        navigator.mediaSession.setActionHandler(action, null)
      })
    }
  }, [currentSong, togglePlay, handleNext, handlePrev, seek])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(currentTime, duration),
    })
  }, [currentTime, duration])

  if (!currentSong) return null

  const progress = duration ? (currentTime / duration) * 100 : 0
  const repeatColor = repeat === 'none' ? APP_CONFIG.theme.textMuted : APP_CONFIG.theme.primary

  const renderThumbnail = (className) => {
    if (currentSong.artwork_url) {
      return (
        <img 
          src={currentSong.artwork_url} 
          alt={currentSong.title} 
          crossOrigin="anonymous"
          className={`${className} object-cover shadow-md border`}
          style={{ borderColor: APP_CONFIG.theme.surfaceHover }}
        />
      )
    }
    return (
      <div 
        className={`${className} flex items-center justify-center shadow-md border`}
        style={{ backgroundColor: APP_CONFIG.theme.accent, borderColor: APP_CONFIG.theme.surfaceHover }}
      >
        <span style={{ color: APP_CONFIG.theme.primary }} className="font-bold text-xl">🎵</span>
      </div>
    )
  }

  return (
    <>
      {/* Full Screen Player */}
      {expanded && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-between transition-all mobile-height safe-padding-top safe-padding-bottom" 
          style={{ backgroundColor: APP_CONFIG.theme.bg }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <button 
              onClick={() => setExpanded(false)} 
              className="flex items-center gap-2 text-sm font-semibold transition-colors"
              style={{ color: APP_CONFIG.theme.textMuted }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              Now Playing
            </button>
          </div>

          {/* Album Cover */}
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className="w-72 h-72 rounded-2xl overflow-hidden mb-8 shadow-xl">
              {renderThumbnail("w-full h-full")}
            </div>
            
            <div className="text-left mb-6 w-full px-2">
              <h2 className="text-2xl font-bold truncate" style={{ color: APP_CONFIG.theme.text }}>
                {currentSong.title}
              </h2>
              <p className="mt-1 text-sm font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>
                {currentSong.artist || 'Unknown Artist'}
              </p>
            </div>

            {/* Seek Bar */}
            <div className="w-full mb-4 px-2" onTouchStart={preventSliderGesture} onTouchMove={preventSliderGesture}>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={e => seek(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ 
                  accentColor: APP_CONFIG.theme.primary,
                  backgroundColor: APP_CONFIG.theme.surfaceHover 
                }}
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs font-mono" style={{ color: APP_CONFIG.theme.textMuted }}>{formatTime(currentTime)}</span>
                <span className="text-xs font-mono" style={{ color: APP_CONFIG.theme.textMuted }}>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between w-full mt-2 mb-8 px-4">
              <button 
                onClick={toggleShuffle} 
                className="transition-transform active:scale-90"
                style={{ color: shuffle ? APP_CONFIG.theme.primary : APP_CONFIG.theme.textMuted }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18h4.5l4.5-6 4.5-6H21"/><path d="m17 2 4 4-4 4"/><path d="M3 6h4.5l3 4"/><path d="M15 14l3 4h3"/><path d="m17 14 4 4-4 4"/></svg>
              </button>

              <button 
                onClick={handlePrev} 
                className="transition-all active:scale-90"
                style={{ color: APP_CONFIG.theme.text }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#ffffff' }}
              >
                {isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>

              <button 
                onClick={handleNext} 
                className="transition-all active:scale-90"
                style={{ color: APP_CONFIG.theme.text }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
              </button>

              <button 
                onClick={toggleRepeat} 
                className="transition-transform active:scale-90 relative flex flex-col items-center justify-center"
                style={{ color: repeatColor }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                {repeat === 'one' && <span className="absolute text-[8px] font-bold top-1.5 bg-white px-0.5 rounded shadow border text-black">1</span>}
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 w-full px-2 mb-6" onTouchStart={preventSliderGesture} onTouchMove={preventSliderGesture}>
              <span style={{ color: APP_CONFIG.theme.textMuted }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/></svg>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{ 
                  accentColor: APP_CONFIG.theme.primary,
                  backgroundColor: APP_CONFIG.theme.surfaceHover 
                }}
              />
              <span style={{ color: APP_CONFIG.theme.textMuted }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mini Player Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe" style={{ backgroundColor: 'transparent' }}>
        <div
          className="rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-lg border backdrop-blur-md transition-all"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            borderColor: APP_CONFIG.theme.surfaceHover 
          }}
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer" onClick={() => setExpanded(true)}>
            {renderThumbnail("w-full h-full")}
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(true)}>
            <p className="font-bold text-sm truncate leading-tight" style={{ color: APP_CONFIG.theme.text }}>{currentSong.title}</p>
            <p className="text-xs truncate mt-1 font-medium" style={{ color: APP_CONFIG.theme.textMuted }}>
              {currentSong.artist || 'Unknown Artist'} · {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={handlePrev} 
              className="transition-all active:scale-90"
              style={{ color: APP_CONFIG.theme.textMuted }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md"
              style={{ backgroundColor: APP_CONFIG.theme.primary, color: '#ffffff' }}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <button 
              onClick={handleNext} 
              className="transition-all active:scale-90"
              style={{ color: APP_CONFIG.theme.textMuted }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mt-2 overflow-hidden px-1 mb-1" style={{ backgroundColor: APP_CONFIG.theme.surface }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: APP_CONFIG.theme.primary }}
          />
        </div>
      </div>
    </>
  )
}