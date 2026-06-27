import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PlaylistDetail from './pages/PlaylistDetail'
import MiniPlayer from './components/MiniPlayer'

export default function App() {
  return (
    <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#ffffff' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
      </Routes>
      <MiniPlayer />
    </div>
  )
}