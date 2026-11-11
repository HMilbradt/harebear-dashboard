import "@tanstack/react-start/server-only"
import { watch } from "node:fs"
import { mkdir, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { type ConfigError, type LoadedConfig, loadConfig } from "./config"
import { startLocalPlugins } from "./local-plugins"

export interface StoreState {
  /** Bumped on every reload attempt, good or bad, so clients refetch. */
  version: number
  /** Last config that validated. Kept when a later edit is invalid. */
  config?: LoadedConfig
  /** Errors from the latest attempt. Empty when the latest edit is live. */
  errors: ConfigError[]
  dir: string
}

type Listener = (state: StoreState) => void

class ConfigStore {
  state: StoreState
  private listeners = new Set<Listener>()
  private ready: Promise<void>
  private timer: NodeJS.Timeout | undefined
  private signature = ""

  constructor(dir: string) {
    this.state = { version: 0, errors: [], dir }
    // Local plugins first: page configs may use their widget types.
    this.ready = startLocalPlugins(() => void this.reload())
      .catch((err) => console.warn(`[plugins] ${(err as Error).message}`))
      .then(() => this.reload())
      .then(() => this.watch())
  }

  async get(): Promise<StoreState> {
    await this.ready
    return this.state
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Names, sizes and mtimes of the config files: changes when any file does. */
  private async stamp(): Promise<string> {
    const pages = await readdir(path.join(this.state.dir, "pages")).catch(() => [] as string[])
    const files = ["dashboard.yaml", ...pages.map((f) => `pages/${f}`)]
    const parts = await Promise.all(
      files.map((f) =>
        stat(path.join(this.state.dir, f)).then(
          (s) => `${f}:${s.mtimeMs}:${s.size}`,
          () => "",
        ),
      ),
    )
    return parts.join("|")
  }

  private schedule() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.reload(), 200)
  }

  private async reload() {
    this.signature = await this.stamp()
    let result: Awaited<ReturnType<typeof loadConfig>>
    try {
      result = await loadConfig(this.state.dir)
    } catch (err) {
      result = { errors: [{ file: "", path: "", message: (err as Error).message }] }
    }
    this.state = {
      ...this.state,
      version: this.state.version + 1,
      config: result.config ?? this.state.config,
      errors: result.errors,
    }
    if (result.errors.length) {
      console.warn(
        `[config] ${result.errors.length} error(s); ${this.state.config ? "keeping the last good config" : "no valid config yet"}`,
      )
      for (const e of result.errors) console.warn(`  ${e.file}${e.line ? `:${e.line}` : ""} ${e.path} ${e.message}`)
    } else {
      console.log(`[config] loaded ${result.config?.pages.length ?? 0} page(s), version ${this.state.version}`)
      const host = process.env.HOST ?? "0.0.0.0"
      if (result.config?.dashboard.auth.mode === "none" && !["127.0.0.1", "localhost", "::1"].includes(host)) {
        console.warn("[auth] mode none: anyone who can reach this port sees the dashboard. Restrict it at your proxy.")
      }
    }
    for (const fn of this.listeners) fn(this.state)
  }

  private async watch() {
    await mkdir(path.join(this.state.dir, "pages"), { recursive: true }).catch(() => {})
    try {
      watch(this.state.dir, { recursive: true }, (_event, file) => {
        if (file && !/\.ya?ml$/.test(file.toString())) return
        this.schedule()
      })
    } catch (err) {
      console.warn(`[config] cannot watch ${this.state.dir}: ${(err as Error).message}. Falling back to polling.`)
    }
    // File events are unreliable on some mounts (Docker Desktop, NFS), so also compare file stamps every 3s.
    setInterval(async () => {
      if ((await this.stamp()) !== this.signature) this.schedule()
    }, 3000).unref()
  }
}

const g = globalThis as { __harebearStore?: ConfigStore }

export function configStore(): ConfigStore {
  g.__harebearStore ??= new ConfigStore(path.resolve(process.env.CONFIG_DIR ?? "config"))
  return g.__harebearStore
}
