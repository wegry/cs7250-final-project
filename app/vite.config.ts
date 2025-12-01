import netlify from "@netlify/vite-plugin";

/** @type {import('vite').UserConfig} */
export default {
  plugins: [
    // netlify()
  ],
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless", // Changed from require-corp
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    proxy: {
      // Proxy tile requests to avoid CORS
      "/tiles": {
        target: "https://tile.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/tiles/, ""),
      },
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless", // Changed from require-corp
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
};
