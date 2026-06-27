// src/lib/itunes.js

export async function fetchSongMetadata(title) {
  try {
    const query = encodeURIComponent(title)
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`)
    const data = await res.json()
    
    if (data.results && data.results.length > 0) {
      const track = data.results[0]
      return {
        artworkUrl: track.artworkUrl100.replace('100x100', '500x500'),
        artistName: track.artistName || 'Unknown Artist'
      }
    }
    return null
  } catch {
    return null
  }
}