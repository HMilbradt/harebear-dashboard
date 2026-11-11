// Production server: static assets from dist/client, everything else to TanStack Start.
import { serve } from "srvx"
import { staticMiddleware } from "srvx/static"
import app from "./dist/server/server.js"

const host = process.env.HOST ?? "0.0.0.0"
const port = Number(process.env.PORT ?? 3000)

serve({
  hostname: host,
  port,
  middleware: [staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname, maxAge: 3600 })],
  fetch: app.fetch,
})

if (!["127.0.0.1", "localhost", "::1"].includes(host) && (process.env.AUTH ?? "none") === "none") {
  console.warn(
    `[auth] No authentication, listening on ${host}:${port}. Put the dashboard behind a proxy that restricts access.`,
  )
}
