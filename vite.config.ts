import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { catalogPlugin, loadProfile, packageRoot } from "./scripts/catalog-plugin.mjs";

export default defineConfig(({ mode }) => {
  const config = loadProfile(loadEnv(mode, packageRoot, 'VITE_'));
  return {
    plugins: [catalogPlugin(config), react()],
    base: new URL(config.publicUrl).pathname,
    // Copy only assets selected by the profile, never another business's public directory.
    publicDir: false,
    server: { port: 5176 },
  };
});
