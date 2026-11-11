import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@tanstack/react-start/server-only",
        replacement: fileURLToPath(new URL("./test/noop.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  test: { environment: "node", testTimeout: 20_000 },
})
