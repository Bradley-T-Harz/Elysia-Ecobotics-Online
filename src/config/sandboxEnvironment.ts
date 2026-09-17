const sandboxBuild = import.meta.env.VITE_ELYSIA_ENVIRONMENT === "sandbox";
const protectedOrigin = "https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev";
export const sandboxOrigin = sandboxBuild ? protectedOrigin : null;
export const isSandboxBuild = sandboxBuild;
