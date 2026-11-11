import { createMiddleware, createStart } from "@tanstack/react-start"
import { setResponseHeaders } from "@tanstack/react-start/server"

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const { configStore } = await import("./server/store")
  const { cspHeader } = await import("./server/csp")
  const s = await configStore().get()
  setResponseHeaders(
    new Headers({
      "content-security-policy": cspHeader(s.config),
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    }),
  )
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
