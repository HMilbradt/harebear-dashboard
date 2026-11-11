import "@tanstack/react-start/server-only"
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import type { DashboardConfig } from "./config"

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>

export const SESSION_COOKIE = "hbd_session"
/** Set by server.mjs from the socket address; any client-sent value is dropped first. */
export const PEER_HEADER = "x-harebear-peer"
const SESSION_DAYS = 30

/** "scrypt$N$r$p$salt$hash", all base64. Made by `harebear-dashboard hash-password`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const N = 16384
  const r = 8
  const p = 1
  const hash = await scryptAsync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$")
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, N, r, p, salt, hash] = stored.split("$")
  if (kind !== "scrypt" || !N || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64")
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Session key derived from the password hash: changing the password signs everyone out. */
function sessionKey(passwordHash: string) {
  return createHash("sha256").update(`harebear-dashboard session:${passwordHash}`).digest()
}

export function issueSession(passwordHash: string, now = Date.now()) {
  const exp = now + SESSION_DAYS * 86_400_000
  const mac = createHmac("sha256", sessionKey(passwordHash)).update(String(exp)).digest("base64url")
  return { value: `${exp}.${mac}`, maxAge: SESSION_DAYS * 86_400 }
}

export function validSession(token: string | undefined, passwordHash: string, now = Date.now()): boolean {
  if (!token) return false
  const [exp, mac] = token.split(".")
  if (!exp || !mac || Number(exp) < now) return false
  const expected = createHmac("sha256", sessionKey(passwordHash)).update(exp).digest()
  const given = Buffer.from(mac, "base64url")
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return decodeURIComponent(v.join("="))
  }
  return undefined
}

/* ---------- CIDR ---------- */

function ipv4ToInt(ip: string): number | undefined {
  const parts = ip.split(".")
  if (parts.length !== 4) return undefined
  let n = 0
  for (const p of parts) {
    const v = Number(p)
    if (!/^\d+$/.test(p) || v > 255) return undefined
    n = n * 256 + v
  }
  return n
}

/** IPv4 CIDRs and exact IPv6 addresses. IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4. */
export function ipAllowed(ip: string | undefined, allowed: string[]): boolean {
  if (!ip) return false
  const addr = ip.replace(/^::ffff:/i, "")
  const n = ipv4ToInt(addr)
  for (const entry of allowed) {
    const [net, bitsText] = entry.split("/")
    if (n !== undefined) {
      const base = ipv4ToInt(net ?? "")
      if (base === undefined) continue
      const bits = bitsText === undefined ? 32 : Number(bitsText)
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
      if ((n & mask) >>> 0 === (base & mask) >>> 0) return true
    } else if (addr.toLowerCase() === entry.toLowerCase()) {
      return true
    }
  }
  return false
}

/* ---------- decisions ---------- */

export type AuthConfig = DashboardConfig["auth"]

/** Who the request is, or undefined when it must sign in. */
export function authorize(request: Request, auth: AuthConfig, passwordHash?: string): string | undefined {
  if (auth.mode === "none") return "anonymous"
  if (auth.mode === "proxy") {
    const peer = request.headers.get(PEER_HEADER) ?? undefined
    if (!ipAllowed(peer, auth.proxy.trustedProxies)) return undefined
    return request.headers.get(auth.proxy.header)?.trim() || undefined
  }
  if (!passwordHash) return undefined
  return validSession(readCookie(request.headers.get("cookie"), SESSION_COOKIE), passwordHash) ? "owner" : undefined
}

/* ---------- login rate limit ---------- */

const attempts = new Map<string, number[]>()
const WINDOW = 15 * 60_000
const MAX_ATTEMPTS = 10

export function loginAllowed(key: string, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW)
  attempts.set(key, recent)
  return recent.length < MAX_ATTEMPTS
}

export function recordFailure(key: string, now = Date.now()) {
  attempts.set(key, [...(attempts.get(key) ?? []), now])
}
