import { z } from "zod"
import { definePlugin, hostOf } from "@/sdk/plugin"
import { ago } from "../_shared/time"

const field = z
  .object({
    label: z.string(),
    path: z.string().describe("Dot path into the item (or the response for stats/key-value), e.g. data.download.avg"),
    format: z.enum(["text", "number", "bytes", "percent", "date", "ago"]).default("text"),
    unit: z.string().optional(),
    scale: z.number().optional().describe("Multiply numbers first, e.g. 0.000001 for bits to Mbit"),
    decimals: z.number().int().min(0).max(6).optional(),
  })
  .strict()

export function pick(value: unknown, path: string): unknown {
  if (!path || path === ".") return value
  let cur: unknown = value
  for (const key of path.split(".")) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function format(raw: unknown, f: z.infer<typeof field>, now: number): string {
  if (raw === null || raw === undefined) return "–"
  const n = typeof raw === "number" ? raw : Number(raw)
  const num = (v: number) =>
    v.toLocaleString("en", { maximumFractionDigits: f.decimals ?? 2, minimumFractionDigits: f.decimals ?? 0 })
  switch (f.format) {
    case "number":
      return Number.isFinite(n) ? num(n * (f.scale ?? 1)) : String(raw)
    case "percent":
      return Number.isFinite(n) ? `${num(n * (f.scale ?? 1))}%` : String(raw)
    case "bytes": {
      if (!Number.isFinite(n)) return String(raw)
      const units = ["B", "KB", "MB", "GB", "TB", "PB"]
      let v = n * (f.scale ?? 1)
      let i = 0
      while (Math.abs(v) >= 1000 && i < units.length - 1) {
        v /= 1000
        i++
      }
      return `${num(v)} ${units[i]}`
    }
    case "date":
    case "ago": {
      const t = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(String(raw))
      if (Number.isNaN(t)) return String(raw)
      return f.format === "ago" ? ago(t, now) : new Date(t).toISOString().slice(0, 16).replace("T", " ")
    }
    default:
      return typeof raw === "object" ? JSON.stringify(raw) : String(raw)
  }
}

export default definePlugin({
  id: "http",
  name: "HTTP",
  description:
    "Any JSON API, no code: fetch a URL, pick values with dot paths, show them as stats, key-value pairs, a list, links or a table.",
  options: z.object({
    url: z.url(),
    method: z.enum(["GET", "POST"]).default("GET"),
    headers: z
      .record(z.string(), z.string())
      .default({})
      .describe("Request headers. {secret.NAME} is replaced with secrets.NAME"),
    body: z.string().optional(),
    view: z.enum(["stats", "key-value", "list", "links", "table"]).default("key-value"),
    items: z.string().optional().describe("Dot path to the array to list (list, links, table)"),
    fields: z.array(field).default([]).describe("stats, key-value and table: the values to show"),
    itemTitle: z.string().optional().describe("list/links: path of the title"),
    itemSubtitle: z.string().optional().describe("list/links: path of the second line"),
    itemUrl: z.string().optional().describe("list/links: path of the link"),
    limit: z.number().int().min(1).max(200).default(50),
    collapseAfter: z.number().int().min(1).default(5),
  }),
  secrets: z.object({}).catchall(z.string()),
  hosts: (o) => hostOf(o.url),
  refresh: "5m",
  async load({ options: o, secrets, fetch }) {
    const fill = (v: string) =>
      v.replace(/\{secret\.([A-Za-z0-9_]+)\}/g, (_, k: string) => {
        const s = (secrets as Record<string, string>)[k]
        if (s === undefined) throw new Error(`Header uses {secret.${k}} but secrets.${k} is not set`)
        return s
      })
    const headers = Object.fromEntries(Object.entries(o.headers).map(([k, v]) => [k, fill(v)]))
    const res = await fetch(o.url, {
      method: o.method,
      headers: { accept: "application/json", ...headers },
      body: o.body,
    })
    if (!res.ok) throw new Error(`${new URL(o.url).host} returned HTTP ${res.status}`)
    const json = await res.json()
    const now = Date.now()

    if (o.view === "stats" || o.view === "key-value") {
      return {
        kind: o.view,
        items: o.fields.map((f) => ({ label: f.label, value: format(pick(json, f.path), f, now), unit: f.unit })),
      }
    }
    const list = pick(json, o.items ?? "")
    if (!Array.isArray(list)) throw new Error(`"${o.items ?? "(response)"}" is not an array`)
    const rows = list.slice(0, o.limit)
    if (o.view === "table") {
      return {
        kind: "table" as const,
        columns: o.fields.map((f) => f.label),
        rows: rows.map((r) => o.fields.map((f) => format(pick(r, f.path), f, now))),
        collapseAfter: o.collapseAfter,
      }
    }
    const text = (r: unknown, p?: string) =>
      p ? format(pick(r, p), { label: "", path: p, format: "text" }, now) : undefined
    return {
      kind: o.view,
      collapseAfter: o.collapseAfter,
      rows: rows.map((r) => {
        const url = text(r, o.itemUrl)
        return {
          title: text(r, o.itemTitle) ?? "",
          subtitle: text(r, o.itemSubtitle),
          url: url && /^https?:\/\//.test(url) ? url : undefined,
        }
      }),
    }
  },
})
