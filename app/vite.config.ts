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
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
};
