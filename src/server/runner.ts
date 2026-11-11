import "@tanstack/react-start/server-only"
import { createHash } from "node:crypto"
import { createBroker } from "./broker"
import { resolveEnv, type WidgetConfig } from "./config"
import { localPlugin } from "./local-plugins"
import { getPlugin } from "./registry"

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type WidgetResult =
  | { status: "ok"; data: Json; updatedAt: number }
  | { status: "error"; error: string; updatedAt: number; data?: Json }

interface Entry {
  result?: WidgetResult
  expiresAt: number
  inflight?: Promise<WidgetResult>
  lastUsed: number
}

const ERROR_TTL = 15_000
const LOAD_TIMEOUT = 20_000
const g = globalThis as { __harebearCache?: Map<string, Entry> }
g.__harebearCache ??= new Map()
const cache = g.__harebearCache

/** Same type, options and secret refs share one cache entry, across pages. */
function keyOf(w: WidgetConfig): string {
  return createHash("sha1")
    .update(JSON.stringify([w.type, localPlugin(w.type)?.hash, w.options, w.secretRefs]))
    .digest("hex")
}

/** Cached data for a widget: fresh if possible, stale while a refresh runs in the background. */
export async function widgetData(w: WidgetConfig): Promise<WidgetResult> {
  const key = keyOf(w)
  const now = Date.now()
  let entry = cache.get(key)
  if (!entry) {
    entry = { expiresAt: 0, lastUsed: now }
    cache.set(key, entry)
  }
  entry.lastUsed = now
  if (entry.result && now < entry.expiresAt) return entry.result
  entry.inflight ??= run(w).then((result) => {
    const e = cache.get(key)
    if (e) {
      e.inflight = undefined
      // A failed refresh keeps the last good data, marked as an error.
      const previous = e.result?.data
      e.result = result.status === "error" && previous !== undefined ? { ...result, data: previous } : result
      const ttl = w.refreshMs > 0 ? w.refreshMs : Number.POSITIVE_INFINITY
      e.expiresAt = Date.now() + (result.status === "ok" ? Math.max(ttl - 1000, 5000) : ERROR_TTL)
    }
    return e?.result ?? result
  })
  return entry.result ?? entry.inflight
}

async function run(w: WidgetConfig): Promise<WidgetResult> {
  const plugin = getPlugin(w.type)
  if (!plugin) return { status: "error", error: `Unknown widget type ${w.type}`, updatedAt: Date.now() }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT)
  try {
    const options = w.options
    const secrets = plugin.secrets
      ? plugin.secrets.parse(
          Object.fromEntries(Object.entries(w.secretRefs).map(([k, ref]) => [k, resolveEnv(ref, `secrets.${k}`)])),
        )
      : {}
    const hosts = plugin.hosts?.(options) ?? []
    const data = await plugin.load({
      options,
      secrets,
      fetch: createBroker(hosts, controller.signal),
      widget: { page: w.page, id: w.id },
      signal: controller.signal,
    })
    return { status: "ok", data: JSON.parse(JSON.stringify(data ?? null)) as Json, updatedAt: Date.now() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[widget] ${w.page}/${w.id} (${w.type}): ${message}`)
    return { status: "error", error: message, updatedAt: Date.now() }
  } finally {
    clearTimeout(timer)
  }
}

/** Drop entries no widget has asked for in a day, so edited options do not pile up. */
setInterval(() => {
  const cutoff = Date.now() - 86_400_000
  for (const [k, e] of cache) if (e.lastUsed < cutoff && !e.inflight) cache.delete(k)
}, 3_600_000).unref()
