import { readdir, readFile, statfs } from "node:fs/promises"
import os from "node:os"
import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"

let lastCpu: { idle: number; total: number } | undefined

async function cpuSample() {
  try {
    const line = (await readFile("/proc/stat", "utf8")).split("\n")[0] ?? ""
    const n = line.trim().split(/\s+/).slice(1).map(Number)
    const idle = (n[3] ?? 0) + (n[4] ?? 0)
    return { idle, total: n.reduce((a, b) => a + b, 0) }
  } catch {
    const cpus = os.cpus()
    const idle = cpus.reduce((a, c) => a + c.times.idle, 0)
    const total = cpus.reduce((a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0), 0)
    return { idle, total }
  }
}

async function cpuPercent(): Promise<number> {
  let prev = lastCpu
  if (!prev) {
    prev = await cpuSample()
    await new Promise((r) => setTimeout(r, 250))
  }
  const cur = await cpuSample()
  lastCpu = cur
  const total = cur.total - prev.total
  return total > 0 ? Math.round((1 - (cur.idle - prev.idle) / total) * 100) : 0
}

async function memory() {
  try {
    const info = await readFile("/proc/meminfo", "utf8")
    const kb = (k: string) => Number(new RegExp(`^${k}:\\s+(\\d+)`, "m").exec(info)?.[1] ?? 0) * 1024
    return { total: kb("MemTotal"), used: kb("MemTotal") - kb("MemAvailable") }
  } catch {
    return { total: os.totalmem(), used: os.totalmem() - os.freemem() }
  }
}

async function temperature(): Promise<number | undefined> {
  try {
    const zones = (await readdir("/sys/class/thermal")).filter((z) => z.startsWith("thermal_zone"))
    const temps = await Promise.all(
      zones.map((z) => readFile(`/sys/class/thermal/${z}/temp`, "utf8").then(Number, () => Number.NaN)),
    )
    const max = Math.max(...temps.filter(Number.isFinite))
    return Number.isFinite(max) ? Math.round(max / 1000) : undefined
  } catch {
    return undefined
  }
}

export default definePlugin({
  id: "server-stats",
  name: "Server",
  description:
    "CPU, memory, disks, load and uptime of the machine running the dashboard. In Docker this is the host, except disks, which must be mounted in.",
  options: z.object({
    name: z.string().optional().describe("Shown as the title line. Default: host name."),
    disks: z
      .array(z.object({ path: z.string(), label: z.string().optional() }).strict())
      .default([{ path: "/" }])
      .describe("Mount points inside the container to report"),
  }),
  refresh: "15s",
  async load({ options }) {
    const [cpu, mem, temp, disks] = await Promise.all([
      cpuPercent(),
      memory(),
      temperature(),
      Promise.all(
        options.disks.map(async (d) => {
          try {
            const s = await statfs(d.path)
            const total = s.blocks * s.bsize
            return { label: d.label ?? d.path, total, used: total - s.bavail * s.bsize }
          } catch (err) {
            return { label: d.label ?? d.path, total: 0, used: 0, error: (err as Error).message }
          }
        }),
      ),
    ])
    return {
      name: options.name ?? os.hostname(),
      cpu,
      cores: os.cpus().length,
      load: os.loadavg().map((l) => Math.round(l * 100) / 100),
      mem,
      temp,
      disks,
      uptime: os.uptime(),
    }
  },
})
