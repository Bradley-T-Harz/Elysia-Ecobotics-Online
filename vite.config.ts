import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The first safe asset generation is deliberately namespaced away from the
// historical Pages redirect bug, which cached 24-byte fallback bodies under
// otherwise valid content-hashed JavaScript URLs with an immutable TTL.
const browserAssetNamespace = "safe-assets-v1";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        artisanCollective: new URL("./artisan-collective.html", import.meta.url).pathname
      },
      output: {
        entryFileNames: `assets/${browserAssetNamespace}-[name]-[hash].js`,
        chunkFileNames: `assets/${browserAssetNamespace}-[name]-[hash].js`,
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "vendor-react";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons-ui";
          if (id.includes("/src/pages/The-Elysia-Marketplace/")) return "marketplace";
          if (id.includes("/src/pages/The-Developer-Forge/")) return "developer-forge";
          if (id.includes("/src/pages/Admin/")) return "admin-ui";
          if (id.includes("/src/pages/The-Elysia-Commune/")) return "commune";
          if (id.includes("/src/pages/The-Living-Library/")) return "living-library";
          if (id.includes("/src/pages/The-Commons-Circle/") || id.includes("/src/pages/Public-Commons-Profile/")) return "commons-circle";
          if (id.includes("/src/pages/Elysia-Artisan-Collective/")) return "artisan-collective";
          if (id.includes("/src/pages/Legal/")) return "legal";
        }
      }
    }
  }
});
