import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text" })

export default definePlugin({
  id: "rss",
  name: "RSS",
  description: "Latest items from RSS and Atom feeds, merged and sorted by date.",
  options: z.object({
    feeds: z.array(z.object({ url: z.url(), title: z.string().optional() }).strict()).min(1),
    limit: z.number().int().min(1).max(100).default(20),
    collapseAfter: z.number().int().min(1).default(5),
  }),
  hosts: (o) => o.feeds.map((f) => new URL(f.url).host),
  refresh: "30m",
  async load({ options, fetch }) {
    const results = await Promise.allSettled(
      options.feeds.map(async (feed) => {
        const res = await fetch(feed.url, { headers: { accept: "application/rss+xml, application/atom+xml, */*" } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return parseFeed(await res.text(), feed.title)
      }),
    )
    const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    const failed = results.flatMap((r, i) =>
      r.status === "rejected"
        ? [`${options.feeds[i]?.title ?? options.feeds[i]?.url}: ${(r.reason as Error).message}`]
        : [],
    )
    if (!items.length && failed.length) throw new Error(failed.join("; "))
    items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    return { items: items.slice(0, options.limit), failed, collapseAfter: options.collapseAfter, now: Date.now() }
  },
})

type Node = Record<string, unknown>
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const text = (v: unknown): string =>
  typeof v === "string"
    ? v
    : typeof v === "number"
      ? String(v)
      : v && typeof v === "object"
        ? text((v as Node)["#text"])
        : ""

function parseFeed(xml: string, title?: string) {
  const doc = parser.parse(xml) as Node
  const rss = (doc.rss as Node | undefined)?.channel as Node | undefined
  if (rss) {
    const source = title ?? text(rss.title)
    return arr(rss.item as Node[]).map((it) => ({
      title: decode(text(it.title)) || "(untitled)",
      url: text(it.link) || text((it.guid as Node | undefined) ?? ""),
      source,
      publishedAt: date(text(it.pubDate) || text(it["dc:date"])),
    }))
  }
  const atom = doc.feed as Node | undefined
  if (atom) {
    const source = title ?? text(atom.title)
    return arr(atom.entry as Node[]).map((it) => {
      const links = arr(it.link as Node[])
      const link = links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0]
      return {
        title: decode(text(it.title)) || "(untitled)",
        url: text(link?.["@href"]),
        source,
        publishedAt: date(text(it.published) || text(it.updated)),
      }
    })
  }
  throw new Error("not an RSS or Atom feed")
}

function date(s: string): number | undefined {
  const t = Date.parse(s)
  return Number.isNaN(t) ? undefined : t
}

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[m] ?? m,
    )
    .trim()
}
