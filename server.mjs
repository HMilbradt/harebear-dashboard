// Production server: static assets from dist/client, everything else to TanStack Start.
import { serve } from "srvx"
import { staticMiddleware } from "srvx/static"
import app from "./dist/server/server.js"

const host = process.env.HOST ?? "0.0.0.0"
const port = Number(process.env.PORT ?? 3000)

const PEER_HEADER = "x-harebear-peer"

serve({
  hostname: host,
  port,
  middleware: [
    // The socket address, for auth.mode: proxy. A client-sent value is never trusted.
    (request, next) => {
      request.headers.delete(PEER_HEADER)
      if (request.ip) request.headers.set(PEER_HEADER, request.ip)
      return next()
    },
    staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname }),
  ],
  fetch: app.fetch,
})
