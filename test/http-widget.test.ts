import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import http from "@/plugins/http/server"
import { createBroker } from "@/server/broker"

let server: Server
let base: string
let authSeen: string | undefined

beforeAll(async () => {
  server = createServer((req, res) => {
    authSeen = req.headers.authorization
    res.setHeader("content-type", "application/json")
    res.end(
      JSON.stringify({
        data: { download_bits: 512_300_000, disk: 2_500_000_000 },
        items: [
          { name: "alpha", url: "https://a.example", n: 1 },
          { name: "beta", url: "javascript:alert(1)", n: 2 },
        ],
      }),
    )
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

async function run(options: Record<string, unknown>, secrets: Record<string, string> = {}) {
  const parsed = http.options.parse({ url: base, ...options })
  return http.load({
    options: parsed,
    secrets,
    fetch: createBroker(http.hosts?.(parsed) ?? []),
    widget: { page: "p", id: "w" },
    signal: new AbortController().signal,
  })
}

describe("http widget", () => {
  it("formats stats with scale, units and bytes", async () => {
    const data = await run({
      view: "stats",
      fields: [
        { label: "Down", path: "data.download_bits", format: "number", scale: 0.000001, decimals: 1, unit: "Mbps" },
        { label: "Disk", path: "data.disk", format: "bytes" },
      ],
    })
    expect(data).toEqual({
      kind: "stats",
      items: [
        { label: "Down", value: "512.3", unit: "Mbps" },
        { label: "Disk", value: "2.5 GB", unit: undefined },
      ],
    })
  })

  it("lists items and drops non-http links", async () => {
    const data = (await run({ view: "list", items: "items", itemTitle: "name", itemUrl: "url" })) as {
      rows: { title: string; url?: string }[]
    }
    expect(data.rows).toEqual([
      { title: "alpha", subtitle: undefined, url: "https://a.example" },
      { title: "beta", subtitle: undefined, url: undefined },
    ])
  })

  it("builds a table", async () => {
    const data = await run({
      view: "table",
      items: "items",
      fields: [
        { label: "Name", path: "name" },
        { label: "N", path: "n" },
      ],
    })
    expect(data).toMatchObject({
      columns: ["Name", "N"],
      rows: [
        ["alpha", "1"],
        ["beta", "2"],
      ],
    })
  })

  it("fills {secret.NAME} in headers", async () => {
    await run({ headers: { authorization: "Bearer {secret.token}" } }, { token: "s3cr3t" })
    expect(authSeen).toBe("Bearer s3cr3t")
    await expect(run({ headers: { authorization: "Bearer {secret.missing}" } })).rejects.toThrow(/secrets.missing/)
  })
})
