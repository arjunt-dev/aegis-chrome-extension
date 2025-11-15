import './App.css'
import { HashRouter,BrowserRouter, Routes, Route } from 'react-router'
import Home from './pages/Home'
import PredictionHistory from './pages/PredictionHistory'
import BlockList from './pages/BlockList'

function App() {
  const Router = process.env.NODE_ENV ==='development'? BrowserRouter:HashRouter
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<Home />} />
        <Route path="/history" element={<PredictionHistory />} />
        <Route path='/blocklist' element={<BlockList />} />
      </Routes>
    </Router>
  )
}

export default App
