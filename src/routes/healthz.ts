import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const { configStore } = await import("@/server/store")
        const s = await configStore().get()
        return Response.json({
          ok: true,
          version: s.version,
          pages: s.config?.pages.length ?? 0,
          errors: s.errors.length,
        })
      },
    },
  },
})
