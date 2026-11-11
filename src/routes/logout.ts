import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/logout")({
  server: {
    handlers: {
      POST: async () => {
        const { SESSION_COOKIE } = await import("@/server/auth")
        return new Response(null, {
          status: 303,
          headers: {
            location: "/login",
            "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
          },
        })
      },
    },
  },
})
