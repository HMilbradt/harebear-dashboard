/**
 * Renders a page from the production build with a sentinel secret and checks
 * that neither the secret nor the server-side URL reaches the browser.
 * Run after `pnpm build`.
 */
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const SENTINEL = "SENTINEL-c0ffee-5ecret"
const built = path.resolve("dist/server/server.js")
let upstream: Server
let upstreamUrl: string
let authSeen: string | undefined
let app: { fetch: (req: Request) => Promise<Response> }

beforeAll(async () => {
  if (!existsSync(built)) throw new Error("Run `pnpm build` before this test")
  upstream = createServer((req, res) => {
    authSeen = req.headers.authorization
    res.setHeader("content-type", "application/json")
    if (req.url === "/api/v1/results/latest") {
      return res.end(JSON.stringify({ data: { download_bits: 500e6, upload_bits: 50e6, ping: 12 } }))
    }
    res.end(JSON.stringify({ data: { download: { avg_bits: 400e6 }, upload: { avg_bits: 50e6 }, ping: { avg: 10 } } }))
  })
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r))
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`

  const dir = await mkdtemp(path.join(tmpdir(), "hbd-leak-"))
  await mkdir(path.join(dir, "pages"))
  await writeFile(
    path.join(dir, "pages", "home.yaml"),
    `title: Home
columns:
  - size: full
    widgets:
      - id: speed
        type: speedtest-tracker
        url: env:HBD_LEAK_URL
        secrets:
          token: env:HBD_LEAK_TOKEN
`,
  )
  process.env.CONFIG_DIR = dir
  process.env.HBD_LEAK_URL = upstreamUrl
  process.env.HBD_LEAK_TOKEN = SENTINEL
  app = (await import(/* @vite-ignore */ built)).default
})
afterAll(() => upstream?.close())

describe("secret leak", () => {
  it("uses the secret on the server but never sends it or the upstream URL to the browser", async () => {
    const res = await app.fetch(new Request("http://localhost/"))
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(authSeen).toBe(`Bearer ${SENTINEL}`)
    expect(html).toMatch(/down:500\b|"down":500\b/)
    expect(html).not.toContain(SENTINEL)
    expect(html).not.toContain(upstreamUrl)
    expect(html).not.toContain("HBD_LEAK")
    expect(res.headers.get("content-security-policy")).toContain("connect-src 'self'")
  })

  it("keeps secrets out of the health endpoint", async () => {
    const body = await (await app.fetch(new Request("http://localhost/healthz"))).text()
    expect(body).not.toContain(SENTINEL)
  })
})
