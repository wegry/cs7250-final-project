import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './global.css'
import * as s from './App.module.css'

const Storytelling = lazy(() => import('./pages/Storytelling'))
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

// Trigger loading db on app load
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <nav className={s.nav}>
          <Link className={s.title} to="/">
            Visualizing Variable Electricity Pricing
          </Link>
          <div className={s.links}>
            <Link to="/">Home</Link>
            <Link to="/detail">Detail View</Link>
            <Link to="/compare">Compare Plans</Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Storytelling />} />
          <Route path="/detail" element={<DetailView />} />
          <Route path="/detail/:id" element={<DetailView />} />
          <Route path="compare" element={<RegionalElectricityPatterns />} />
          {/* with params */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
