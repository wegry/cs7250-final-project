import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

const DetailView = lazy(() => import('./pages/DetailView'))
const RegionalElectricityPatterns = lazy(() => import('./pages/ComparePlans'))

export function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/detail">Detail View</Link>
        <Link to="/compare">Compare Plans</Link>
      </nav>

      <Routes>
        <Route path="/" element={<div>Placeholder</div>} />
        <Route path="/detail" element={<DetailView />} />
        <Route path="compare" element={<RegionalElectricityPatterns />} />
        {/* with params */}
      </Routes>
    </BrowserRouter>
  )
}
