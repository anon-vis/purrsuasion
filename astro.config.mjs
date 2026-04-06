// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  server: {
    host: "0.0.0.0",
    port: 4321,
  },
  vite: {
    // server: { allowedHosts: ["cf3549e5886d.ngrok-free.app"] },
    worker: { format: "es" },
    plugins: [tailwindcss()],
  },
});
