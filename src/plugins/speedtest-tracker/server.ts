import { z } from "zod"
import { definePlugin, hostOf } from "@/sdk/plugin"

interface Latest {
  data: { download_bits: number; upload_bits: number; ping: number; created_at?: string; updated_at?: string }
}
interface Stats {
  data: { download: { avg_bits: number }; upload: { avg_bits: number }; ping: { avg: number } }
}

const pct = (value: number, avg: number) => (avg ? ((value - avg) / avg) * 100 : undefined)

export default definePlugin({
  id: "speedtest-tracker",
  name: "Speedtest",
  description: "Latest result from Speedtest Tracker, with the change against its average.",
  options: z.object({
    url: z.url().describe("Speedtest Tracker base URL"),
    showDiff: z.boolean().default(true),
  }),
  secrets: z.object({ token: z.string().describe("Speedtest Tracker API token (read access)") }),
  hosts: (o) => hostOf(o.url),
  refresh: "1h",
  async load({ options, secrets, fetch }) {
    const base = options.url.replace(/\/$/, "")
    const headers = { authorization: `Bearer ${secrets.token}`, accept: "application/json" }
    const [latestRes, statsRes] = await Promise.all([
      fetch(`${base}/api/v1/results/latest`, { headers }),
      options.showDiff ? fetch(`${base}/api/v1/stats`, { headers }) : undefined,
    ])
    if (!latestRes.ok) throw new Error(`Speedtest Tracker returned HTTP ${latestRes.status}`)
    const latest = (await latestRes.json<Latest>()).data
    const stats = statsRes?.ok ? (await statsRes.json<Stats>()).data : undefined
    const down = latest.download_bits / 1e6
    const up = latest.upload_bits / 1e6
    return {
      down: Math.round(down * 10) / 10,
      up: Math.round(up * 10) / 10,
      ping: Math.round(latest.ping),
      downDiff: stats ? pct(latest.download_bits, stats.download.avg_bits) : undefined,
      upDiff: stats ? pct(latest.upload_bits, stats.upload.avg_bits) : undefined,
      pingDiff: stats ? pct(latest.ping, stats.ping.avg) : undefined,
      at: latest.created_at ? Date.parse(latest.created_at) : undefined,
    }
  },
})
