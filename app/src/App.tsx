import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, Suspense, useState, useEffect } from "react";
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { Drawer, Button } from "antd";
import { MenuOutlined, SearchOutlined } from "@ant-design/icons";
import * as s from "./App.module.css";
import "./global.css";
import { Footer } from "./components/Footer";
import { useBodyResizeObserver } from "./hooks/useBodyResizeObserver";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const { isMobile } = useBodyResizeObserver();

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const navLinks = (
    <>
      <Link to="/categories">Categories</Link>
      <Link to="/zip-search">
        <SearchOutlined style={{ marginRight: 4 }} />
        Zip Search
      </Link>
      <Link to="/detail">Detail View</Link>
      <Link to="/compare">Compare Plans</Link>
      <Link to="/map">Map</Link>
    </>
  );

  return (
    <div className={s.root}>
      <nav className={s.nav}>
        <Link className={s.title} to="/">
          Visualizing Dynamic Electricity Pricing
        </Link>
        {isMobile ? (
          <>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              className={s.burgerButton}
            />
            <Drawer
              title="Navigation"
              placement="right"
              onClose={() => setDrawerOpen(false)}
              open={drawerOpen}
            >
              <div className={s.drawerLinks}>{navLinks}</div>
            </Drawer>
          </>
        ) : (
          <div className={s.links}>{navLinks}</div>
        )}
      </nav>
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
      <Footer />
    </div>
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
          import("./pages/About").then((module) => ({
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
      {
        path: "about",
        lazy: () =>
          import("./pages/About").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "categories",
        lazy: () =>
          import("./pages/Storytelling").then((module) => ({
            Component: module.default,
          })),
      },
    ],
  },
]);

export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
