import { createFileRoute } from "@tanstack/react-router"

/** Built view bundles of local plugins. File names carry a content hash, so they cache forever. */
export const Route = createFileRoute("/plugins/$id/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { builtFile } = await import("@/server/local-plugins")
        const { readFile } = await import("node:fs/promises")
        const file = builtFile(params.id, params.file)
        const body = file ? await readFile(file).catch(() => undefined) : undefined
        if (!body) return new Response("Not found", { status: 404 })
        return new Response(body, {
          headers: {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "public, max-age=31536000, immutable",
          },
        })
      },
    },
  },
})
