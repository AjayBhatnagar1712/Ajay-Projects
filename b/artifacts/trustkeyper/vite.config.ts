import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { z } from "zod";

const sentryUploadEnabled = process.env.SENTRY_UPLOAD_SOURCEMAPS === "1";

const sentryBuildEnvSchema = z.object({
  SENTRY_AUTH_TOKEN: z.string().trim().min(1),
  SENTRY_ORG: z.string().trim().min(1),
  SENTRY_PROJECT: z.string().trim().min(1),
});

const sentryBuildEnv = sentryUploadEnabled
  ? sentryBuildEnvSchema.safeParse(process.env)
  : null;

if (sentryBuildEnv !== null && !sentryBuildEnv.success) {
  const invalidVariables = sentryBuildEnv.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(
    `Sentry source-map upload is enabled but these build variables are missing or invalid: ${invalidVariables}`,
  );
}

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const sentryRelease =
  process.env.SENTRY_RELEASE?.trim() ||
  (commitSha ? `trustkeyper-app@${commitSha}` : "trustkeyper-app@local");

function resolveSentryEnvironment(): string {
  const explicitEnvironment = process.env.SENTRY_ENVIRONMENT?.trim();
  if (explicitEnvironment) {
    return explicitEnvironment;
  }

  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch === "main") {
    return "production";
  }
  if (branch === "staging") {
    return "staging";
  }
  if (branch || process.env.VERCEL_ENV === "preview") {
    return "preview";
  }
  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  return "local";
}

const sentryEnvironment = resolveSentryEnvironment();

const rawPort = process.env.WEB_PORT ?? process.env.VITE_PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
    ...(sentryBuildEnv?.success
      ? sentryVitePlugin({
          authToken: sentryBuildEnv.data.SENTRY_AUTH_TOKEN,
          org: sentryBuildEnv.data.SENTRY_ORG,
          project: sentryBuildEnv.data.SENTRY_PROJECT,
          errorHandler: (error) => {
            throw error;
          },
          telemetry: false,
          release: {
            name: sentryRelease,
          },
          sourcemaps: {
            filesToDeleteAfterUpload: path
              .resolve(import.meta.dirname, "dist/**/*.map")
              .replaceAll("\\", "/"),
          },
        })
      : []),
  ],
  define: {
    __SENTRY_ENVIRONMENT__: JSON.stringify(sentryEnvironment),
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: sentryUploadEnabled ? "hidden" : false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-slot",
          ],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? `http://127.0.0.1:${process.env.API_PORT ?? "8080"}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
