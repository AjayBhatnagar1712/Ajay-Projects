import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { marketingAnalyticsPlugin } from "./viteAnalyticsPlugin";

const rawPort = process.env.WEBSITE_PORT ?? process.env.VITE_PORT ?? "5174";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid WEBSITE_PORT value: "${rawPort}"`);
}

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname);
  const env = loadEnv(mode, envDir, "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      marketingAnalyticsPlugin(() => env.VITE_ENABLE_ANALYTICS === "1"),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: envDir,
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
  };
});
