import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { configStore } = await import("@/server/store")
        const store = configStore()
        await store.get()
        const enc = new TextEncoder()
        let cleanup = () => {}
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (chunk: string) => {
              try {
                controller.enqueue(enc.encode(chunk))
              } catch {
                cleanup()
              }
            }
            const announce = () =>
              send(
                `event: config\ndata: ${JSON.stringify({ version: store.state.version, errors: store.state.errors.length })}\n\n`,
              )
            announce()
            const unsubscribe = store.subscribe(announce)
            const ping = setInterval(() => send(": ping\n\n"), 25_000)
            cleanup = () => {
              unsubscribe()
              clearInterval(ping)
            }
            request.signal.addEventListener("abort", () => {
              cleanup()
              try {
                controller.close()
              } catch {}
            })
          },
          cancel() {
            cleanup()
          },
        })
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            "x-accel-buffering": "no",
          },
        })
      },
    },
  },
})
