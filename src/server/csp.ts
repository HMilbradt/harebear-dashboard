import "@tanstack/react-start/server-only"
import { serverPlugins } from "@/plugins/server"
import type { LoadedConfig } from "./config"

let cached: { config?: LoadedConfig; header: string } | undefined

/**
 * Content-Security-Policy for the current config. The browser may talk only to
 * this server; images may also come from hosts the enabled plugins declared.
 */
export function cspHeader(config: LoadedConfig | undefined): string {
  if (cached && cached.config === config) return cached.header
  const img = new Set(["'self'", "data:"])
  for (const page of config?.pages ?? []) {
    for (const w of page.widgets.values()) {
      const plugin = serverPlugins.get(w.type)
      if (!plugin?.imageHosts) continue
      try {
        for (const h of plugin.imageHosts(w.options)) img.add(h)
      } catch {
        // Unresolvable env refs surface as a widget error; skip here.
      }
    }
  }
  const header = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${[...img].join(" ")}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
  cached = { config, header }
  return header
}
