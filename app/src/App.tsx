import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider,
  Outlet,
} from 'react-router-dom'
import './global.css'
import * as s from './App.module.css'

const Storytelling = lazy(() => import('./pages/Storytelling'))
const RegionalElectricityPatterns = lazy(() => import('./pages/ComparePlans'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
})

// Layout component for the nav
function Layout() {
  return (
    <>
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
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/Storytelling').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'detail',
        lazy: () =>
          import('./pages/DetailView').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'detail/:id',
        lazy: () =>
          import('./pages/DetailView').then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: 'compare',
        lazy: () =>
          import('./pages/ComparePlans').then((module) => ({
            Component: module.default,
          })),
      },
    ],
  },
])

// Trigger loading db on app load
export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  )
}
