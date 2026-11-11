import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createBroker } from "@/server/broker"

let server: Server
let host: string

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/ok") return res.end("hello")
    if (req.url === "/same") return res.writeHead(302, { location: "/ok" }).end()
    if (req.url === "/other") return res.writeHead(302, { location: "http://example.com/" }).end()
    if (req.url === "/big") return res.end("x".repeat(2048))
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 1000)
    res.writeHead(404).end()
  })
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  host = `127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

describe("broker", () => {
  it("fetches a declared host", async () => {
    const res = await createBroker([host])(`http://${host}/ok`)
    expect(await res.text()).toBe("hello")
  })

  it("refuses an undeclared host", async () => {
    await expect(createBroker(["example.com"])(`http://${host}/ok`)).rejects.toThrow(
      /not in this widget's declared hosts/,
    )
  })

  it("refuses non-http schemes", async () => {
    await expect(createBroker([host])("file:///etc/passwd")).rejects.toThrow(/only http and https/)
  })

  it("follows same-host redirects and refuses cross-host ones", async () => {
    const res = await createBroker([host])(`http://${host}/same`)
    expect(await res.text()).toBe("hello")
    await expect(createBroker([host, "example.com"])(`http://${host}/other`)).rejects.toThrow(/refused redirect/)
  })

  it("can return a redirect as is", async () => {
    const res = await createBroker([host])(`http://${host}/other`, { followRedirects: false })
    expect(res.status).toBe(302)
  })

  it("caps the response size", async () => {
    const res = await createBroker([host])(`http://${host}/big`, { maxBytes: 1024 })
    await expect(res.text()).rejects.toThrow(/larger than 1 KB/)
  })

  it("times out", async () => {
    await expect(createBroker([host])(`http://${host}/slow`, { timeoutMs: 100 })).rejects.toThrow(/timed out/)
  })
})
