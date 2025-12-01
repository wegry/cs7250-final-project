import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, Suspense } from "react";
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import * as s from "./App.module.css";
import "./global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

// Layout component for the nav
function Layout() {
  return (
    <>
      <nav className={s.nav}>
        <Link className={s.title} to="/">
          Visualizing Variable Electricity Pricing
        </Link>
        <div className={s.links}>
          <Link to="/detail">Detail View</Link>
          <Link to="/compare">Compare Plans</Link>
          <Link to="/map">BA Map</Link>
          <Link to="/zip-search">Zip Search</Link>
        </div>
      </nav>
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        lazy: () =>
          import("./pages/Storytelling").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "detail",
        lazy: () =>
          import("./pages/DetailView").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "detail/:id",
        lazy: () =>
          import("./pages/DetailView").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "compare",
        lazy: () =>
          import("./pages/ComparePlans").then((module) => ({
            Component: module.default,
          })),
      },
      // ADD THIS:
      {
        path: "map",
        lazy: () =>
          import("./pages/BAMap").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "zip-search",
        lazy: () =>
          import("./pages/ZipSearch").then((module) => ({
            Component: module.ZipSearch,
          })),
      },
    ],
  },
]);

// Trigger loading db on app load
export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
