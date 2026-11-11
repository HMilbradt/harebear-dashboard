import "@tanstack/react-start/server-only"
import { authorize } from "./auth"
import { dashboardSchema, resolveEnv } from "./config"
import { configStore } from "./store"

let warned = false

/** The current auth settings and the resolved password hash (undefined when unset). */
export async function authSettings() {
  const s = await configStore().get()
  const auth = (s.config?.dashboard ?? dashboardSchema.parse({})).auth
  let passwordHash: string | undefined
  if (auth.mode === "password" && auth.passwordHash) {
    try {
      passwordHash = resolveEnv(auth.passwordHash, "auth.passwordHash")
    } catch (err) {
      if (!warned) console.warn(`[auth] ${(err as Error).message}; nobody can sign in`)
      warned = true
    }
  }
  return { auth, passwordHash }
}

/** User name, or undefined when the request must sign in. Fails closed. */
export async function authorizeRequest(request: Request): Promise<string | undefined> {
  const { auth, passwordHash } = await authSettings()
  return authorize(request, auth, passwordHash)
}
