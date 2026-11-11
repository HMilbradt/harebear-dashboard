import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"
import { iconHosts, iconOption, resolveIcon } from "../_shared/icons"

const site = z
  .object({
    title: z.string(),
    url: z.url().describe("Opened on click, and checked unless checkUrl is set"),
    checkUrl: z.url().optional(),
    icon: iconOption.optional(),
    okStatus: z
      .array(z.number().int().min(100).max(599))
      .optional()
      .describe("Extra HTTP statuses that count as up, e.g. [401] for a service that requires a login"),
  })
  .strict()

export default definePlugin({
  id: "monitor",
  name: "Monitor",
  description:
    "Up/down status and response time for a list of sites. An HTTP status below 400, or one listed in okStatus, counts as up.",
  options: z.object({
    sites: z.array(site).min(1),
    timeoutMs: z.number().int().min(500).max(30_000).default(5000),
  }),
  hosts: (o) => o.sites.map((s) => new URL(s.checkUrl ?? s.url).host),
  imageHosts: (o) => iconHosts(o.sites.map((s) => s.icon)),
  refresh: "1m",
  async load({ options, fetch }) {
    return Promise.all(
      options.sites.map(async (s) => {
        const started = performance.now()
        const base = {
          title: s.title,
          url: s.url,
          icon: resolveIcon(s.icon),
          code: undefined as number | undefined,
          latencyMs: undefined as number | undefined,
          error: undefined as string | undefined,
        }
        try {
          const res = await fetch(s.checkUrl ?? s.url, {
            timeoutMs: options.timeoutMs,
            followRedirects: false,
            maxBytes: 65_536,
          })
          const latencyMs = Math.round(performance.now() - started)
          await res.text().catch(() => {})
          return { ...base, up: res.status < 400 || !!s.okStatus?.includes(res.status), code: res.status, latencyMs }
        } catch (err) {
          return { ...base, up: false, error: (err as Error).message }
        }
      }),
    )
  },
})
