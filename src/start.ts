import { redirect } from "@tanstack/react-router"
import { createMiddleware, createStart } from "@tanstack/react-start"
import { setResponseHeaders } from "@tanstack/react-start/server"

/** Reachable without signing in. Static files are served before this runs. */
const PUBLIC = new Set(["/login", "/logout", "/healthz", "/favicon.svg"])

const guard = createMiddleware().server(async ({ next, request }) => {
  const { configStore } = await import("./server/store")
  const { cspHeader } = await import("./server/csp")
  const { authorizeRequest } = await import("./server/session")
  const s = await configStore().get()
  setResponseHeaders(
    new Headers({
      "content-security-policy": cspHeader(s.config),
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    }),
  )
  const url = new URL(request.url)
  if (!PUBLIC.has(url.pathname) && !(await authorizeRequest(request))) {
    throw redirect({ href: `/login?next=${encodeURIComponent(url.pathname + url.search)}` })
  }
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [guard],
}))
