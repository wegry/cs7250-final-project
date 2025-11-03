import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

const DetailView = lazy(() => import('./pages/DetailView'))

export function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/detail">Detail View</Link>
      </nav>

      <Routes>
        <Route path="/" element={<div>Placeholder</div>} />
        <Route path="/detail" element={<DetailView />} />
        {/* with params */}
      </Routes>
    </BrowserRouter>
  )
}
