import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import * as s from './App.module.css'

const DetailView = lazy(() => import('./pages/DetailView'))
const RegionalElectricityPatterns = lazy(() => import('./pages/ComparePlans'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <nav className={s.nav}>
          <Link to="/">Home</Link>
          <Link to="/detail">Detail View</Link>
          <Link to="/compare">Compare Plans</Link>
        </nav>

        <Routes>
          <Route path="/" element={<div>Placeholder</div>} />
          <Route path="/detail" element={<DetailView />} />
          <Route path="/detail/:id" element={<DetailView />} />
          <Route path="compare" element={<RegionalElectricityPatterns />} />
          {/* with params */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
