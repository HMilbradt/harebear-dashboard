/** Password mode against the production build, and the peer header against server.mjs. Run after `pnpm build`. */
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { hashPassword } from "@/server/auth"

const built = path.resolve("dist/server/server.js")
let app: { fetch: (req: Request) => Promise<Response> }

async function configDir(dashboard: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "hbd-auth-"))
  await mkdir(path.join(dir, "pages"))
  await writeFile(path.join(dir, "dashboard.yaml"), dashboard)
  await writeFile(
    path.join(dir, "pages", "home.yaml"),
    "title: Secret Home\ncolumns:\n  - size: full\n    widgets:\n      - id: c\n        type: clock\n",
  )
  return dir
}

beforeAll(async () => {
  if (!existsSync(built)) throw new Error("Run `pnpm build` before this test")
  process.env.HBD_TEST_HASH = await hashPassword("hunter2")
  process.env.CONFIG_DIR = await configDir("auth:\n  mode: password\n  passwordHash: env:HBD_TEST_HASH\n")
  app = (await import(/* @vite-ignore */ built)).default
})

describe("password mode", () => {
  it("sends signed-out visitors to /login without leaking pages", async () => {
    const res = await app.fetch(new Request("http://localhost/"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toMatch(/^\/login\?next=/)
    const login = await (await app.fetch(new Request("http://localhost/login"))).text()
    expect(login).toContain("Password")
    expect(login).not.toContain("Secret Home")
  })

  it("refuses a wrong password and signs in with the right one", async () => {
    const post = (password: string) =>
      app.fetch(
        new Request("http://localhost/login", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", host: "localhost" },
          body: new URLSearchParams({ password, next: "/" }),
        }),
      )
    const wrong = await post("nope")
    expect(wrong.status).toBe(303)
    expect(wrong.headers.get("location")).toContain("error=wrong")
    expect(wrong.headers.get("set-cookie")).toBeNull()

    const right = await post("hunter2")
    expect(right.status).toBe(303)
    const cookie = right.headers.get("set-cookie")?.split(";")[0] ?? ""
    expect(cookie).toMatch(/^hbd_session=/)
    const page = await app.fetch(new Request("http://localhost/", { headers: { cookie } }))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain("Secret Home")
  })

  it("keeps the health check public", async () => {
    expect((await app.fetch(new Request("http://localhost/healthz"))).status).toBe(200)
  })
})

describe("server.mjs peer header", () => {
  it("ignores a client-sent peer header", async () => {
    const dir = await configDir(
      "auth:\n  mode: proxy\n  proxy:\n    header: Remote-User\n    trustedProxies: [10.9.9.9/32]\n",
    )
    const port = 31000 + Math.floor(Math.random() * 1000)
    const child = spawn(process.execPath, ["server.mjs"], {
      env: { ...process.env, CONFIG_DIR: dir, PORT: String(port), HOST: "127.0.0.1" },
      stdio: "ignore",
    })
    try {
      let res: Response | undefined
      for (let i = 0; i < 50 && !res; i++) {
        res = await fetch(`http://127.0.0.1:${port}/`, {
          redirect: "manual",
          headers: { "x-harebear-peer": "10.9.9.9", "remote-user": "mallory" },
        }).catch(() => undefined)
        if (!res) await new Promise((r) => setTimeout(r, 100))
      }
      expect(res?.status).toBe(307)
      expect(res?.headers.get("location")).toMatch(/^\/login/)
    } finally {
      child.kill()
    }
  })
})
