import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Bundle server dependencies into dist/server so the image needs no node_modules for them.
  // esbuild (native, compiles local plugins) stays external.
  ssr: { noExternal: true, external: ["esbuild"] },
  plugins: [tailwindcss(), tanstackStart(), react()],
})
