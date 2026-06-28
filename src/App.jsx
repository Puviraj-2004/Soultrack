import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Chat from './pages/Chat'
import MiniPlayer from './components/MiniPlayer'
import BottomNav from './components/BottomNav'

export default function App() {
  return (
    <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
      </Routes>
      <MiniPlayer />
      <BottomNav />
    </div>
  )
}
