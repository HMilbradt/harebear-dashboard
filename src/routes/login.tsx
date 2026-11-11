import { createFileRoute } from "@tanstack/react-router"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "harebear-ui"
import { useDashboard } from "@/client/dashboard-context"

function safeNext(value: FormDataEntryValue | string | null | undefined): string {
  const v = typeof value === "string" ? value : ""
  return v.startsWith("/") && !v.startsWith("//") ? v : "/"
}

function see(location: string, cookie?: string) {
  const headers = new Headers({ location })
  if (cookie) headers.set("set-cookie", cookie)
  return new Response(null, { status: 303, headers })
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authSettings } = await import("@/server/session")
        const { issueSession, loginAllowed, PEER_HEADER, recordFailure, SESSION_COOKIE, verifyPassword } = await import(
          "@/server/auth"
        )
        const origin = request.headers.get("origin")
        if (origin && new URL(origin).host !== request.headers.get("host")) {
          return new Response("Cross-origin sign in refused", { status: 403 })
        }
        const form = await request.formData()
        const next = safeNext(form.get("next"))
        const back = (error: string) => see(`/login?error=${error}&next=${encodeURIComponent(next)}`)
        const { auth, passwordHash } = await authSettings()
        if (auth.mode !== "password" || !passwordHash) return back("unavailable")
        const key = request.headers.get(PEER_HEADER) ?? "unknown"
        if (!loginAllowed(key)) return back("locked")
        if (!(await verifyPassword(String(form.get("password") ?? ""), passwordHash))) {
          recordFailure(key)
          return back("wrong")
        }
        const session = issueSession(passwordHash)
        const secure =
          request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:"
        const cookie = `${SESSION_COOKIE}=${session.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${secure ? "; Secure" : ""}`
        return see(next, cookie)
      },
    },
  },
  component: Login,
})

const messages: Record<string, string> = {
  wrong: "That password is not right.",
  locked: "Too many attempts. Try again in 15 minutes.",
  unavailable: "Password sign in is not set up on this dashboard.",
}

function Login() {
  const { next, error } = Route.useSearch()
  const { auth, header } = useDashboard()
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          {header.icon && <img src={header.icon.src} alt="" className="size-10" />}
          <CardTitle>{header.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {auth === "proxy" ? (
            <p className="text-center text-sm text-muted-foreground">
              Sign in through your authentication proxy, then reload this page.
            </p>
          ) : (
            <form method="post" action="/login" className="flex flex-col gap-4">
              <input type="hidden" name="next" value={safeNext(next)} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{messages[error] ?? "Sign in failed."}</p>}
              <Button type="submit">Sign in</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
