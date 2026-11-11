import { describe, expect, it } from "vitest"
import { authorize, hashPassword, ipAllowed, issueSession, validSession, verifyPassword } from "@/server/auth"

const proxyAuth = {
  mode: "proxy" as const,
  proxy: { header: "Remote-User", trustedProxies: ["192.168.4.28/32", "10.0.0.0/8"] },
}

describe("passwords and sessions", () => {
  it("verifies a scrypt hash and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse")
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword("correct horse", hash)).toBe(true)
    expect(await verifyPassword("wrong", hash)).toBe(false)
    expect(await verifyPassword("x", "garbage")).toBe(false)
  })

  it("accepts its own session, rejects tampered, expired, or other-password sessions", async () => {
    const hash = await hashPassword("a")
    const other = await hashPassword("b")
    const { value } = issueSession(hash)
    expect(validSession(value, hash)).toBe(true)
    expect(validSession(value, other)).toBe(false)
    expect(validSession(`${Date.now() + 1e9}.${value.split(".")[1]}`, hash)).toBe(false)
    expect(validSession(issueSession(hash, Date.now() - 31 * 86_400_000).value, hash)).toBe(false)
  })
})

describe("proxy mode", () => {
  it("matches IPv4 CIDRs and mapped addresses", () => {
    expect(ipAllowed("192.168.4.28", ["192.168.4.28/32"])).toBe(true)
    expect(ipAllowed("::ffff:10.1.2.3", ["10.0.0.0/8"])).toBe(true)
    expect(ipAllowed("192.168.4.29", ["192.168.4.28/32"])).toBe(false)
    expect(ipAllowed(undefined, ["0.0.0.0/0"])).toBe(false)
  })

  it("trusts the user header only from a trusted proxy", () => {
    const req = (peer: string) =>
      new Request("http://x/", { headers: { "x-harebear-peer": peer, "remote-user": "harrison" } })
    expect(authorize(req("192.168.4.28"), proxyAuth)).toBe("harrison")
    expect(authorize(req("192.168.4.50"), proxyAuth)).toBeUndefined()
  })
})
