import { z } from "zod"
import { definePlugin, hostOf } from "@/sdk/plugin"
import { resolveIcon } from "../_shared/icons"

interface Container {
  Id: string
  Names: string[]
  Image: string
  State: string
  Status: string
  Labels: Record<string, string>
}

export default definePlugin({
  id: "docker",
  name: "Containers",
  description:
    "Containers and their state, read through a Docker socket proxy that allows only GET /containers. Labels harebear.name, .url, .icon, .description and .hide (or the glance.* equivalents) adjust each one.",
  options: z.object({
    url: z.url().default("http://docker-socket-proxy:2375").describe("Docker API, normally a read-only socket proxy"),
    showStopped: z.boolean().default(true),
    hideByDefault: z.boolean().default(false).describe("Show only containers labelled harebear.hide=false"),
  }),
  hosts: (o) => hostOf(o.url),
  imageHosts: () => ["https://cdn.jsdelivr.net"],
  refresh: "30s",
  async load({ options, fetch }) {
    const base = options.url.replace(/\/$/, "")
    const res = await fetch(`${base}/containers/json?all=${options.showStopped ? 1 : 0}`)
    if (!res.ok) throw new Error(`Docker API returned HTTP ${res.status}`)
    const list = await res.json<Container[]>()
    const label = (c: Container, k: string) => c.Labels[`harebear.${k}`] ?? c.Labels[`glance.${k}`]
    return list
      .filter((c) => {
        const hide = label(c, "hide")
        return hide === undefined ? !options.hideByDefault : hide !== "true"
      })
      .map((c) => ({
        id: c.Id.slice(0, 12),
        name: label(c, "name") ?? c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
        description: label(c, "description"),
        url: label(c, "url"),
        icon: resolveIcon(label(c, "icon")),
        image: c.Image.replace(/@sha256:.*$/, ""),
        state: c.State,
        status: c.Status,
      }))
      .sort((a, b) => Number(b.state === "running") - Number(a.state === "running") || a.name.localeCompare(b.name))
  },
})
