import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        artisanCollective: new URL("./artisan-collective.html", import.meta.url).pathname
      },
      output: {
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
