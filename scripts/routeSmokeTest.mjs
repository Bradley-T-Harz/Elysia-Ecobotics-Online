const requiredRoutes = [
  "/", "/archive", "/marketplace", "/marketplace/browse", "/marketplace/addons/:id",
  "/marketplace/action-preview", "/marketplace/account", "/marketplace/submit", "/marketplace/trust",
  "/marketplace/manifest-api", "/marketplace/admin", "/products", "/lab", "/developer-forge",
  "/living-library", "/commune", "/work-with-elysia-ecobotics", "/commons-circle", "/story",
  "/about", "/mission", "/browse", "/addons/:id", "/action-preview", "/account", "/submit",
  "/trust", "/manifest-api", "/admin"
];
const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8"));
const missing = requiredRoutes.filter((route) => {
  if (route === "/") return !app.includes("<Route index");
  const path = route.replace(/^\//, "");
  const nestedPath = path.replace(/^marketplace\//, "");
  return !(app.includes(`path=\"${path}\"`) || app.includes(`path=\"${nestedPath}\"`) || app.includes(`to=\"${route}\"`) || app.includes(`target=\"${route}\"`));
});
if (missing.length) {
  console.error(`Missing route wiring: ${missing.join(", ")}`);
  process.exit(1);
}
const redirects = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/_redirects", import.meta.url), "utf8"));
if (!redirects.includes("/* /index.html 200")) {
  console.error("Missing Cloudflare Pages SPA redirect.");
  process.exit(1);
}
console.log(`Route contract ok (${requiredRoutes.length} routes/aliases).`);
