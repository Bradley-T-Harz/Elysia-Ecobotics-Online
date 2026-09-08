import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The first safe asset generation is deliberately namespaced away from the
// historical Pages redirect bug, which cached 24-byte fallback bodies under
// otherwise valid content-hashed JavaScript URLs with an immutable TTL.
const browserAssetNamespace = "safe-assets-v1";

export default defineConfig({
  // Isolated readiness builds must never read real .env files into a preview.
  envDir: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ELYSIA_ISOLATED_TEST === "1" ? false : undefined,
  plugins: [react()],
  build: {
    // Vite exposes one warning threshold, while the local Monaco core has a
    // separately enforced raw/gzip budget and must remain demand-loaded.
    // scripts/bundleBudgetAudit.mjs retains the tighter 500 KiB limit for all
    // ordinary application chunks and explicit budgets for every worker.
    chunkSizeWarningLimit: 2560,
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        artisanCollective: new URL("./artisan-collective.html", import.meta.url).pathname
      },
      output: {
        entryFileNames: `assets/${browserAssetNamespace}-[name]-[hash].js`,
        chunkFileNames: (chunkInfo) => {
          const facade = chunkInfo.facadeModuleId ?? "";
          if (facade.endsWith("/src/pages/The-Developer-Forge/index.tsx")) return `assets/${browserAssetNamespace}-developer-forge-[hash].js`;
          if (facade.endsWith("/src/pages/The-Elysia-Commune/index.tsx")) return `assets/${browserAssetNamespace}-commune-[hash].js`;
          if (facade.endsWith("/src/pages/Public-Commons-Profile/index.tsx")) return `assets/${browserAssetNamespace}-commons-profile-[hash].js`;
          if (facade.includes("/src/shared/auth/AuthTurnstile.tsx") || chunkInfo.name === "AuthTurnstile") return `assets/${browserAssetNamespace}-commons-circle-[hash].js`;
          return `assets/${browserAssetNamespace}-[name]-[hash].js`;
        },
        manualChunks(id) {
          if (id.endsWith("/src/pages/The-Elysia-Commune/communeAccountApi.ts")) return "commune-account-api";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "vendor-react";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons-ui";
        }
      }
    }
  }
});
