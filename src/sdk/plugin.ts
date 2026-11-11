import type { z } from "zod"

/** Response returned by `ctx.fetch`. The body is read once, with a size cap. */
export interface BrokerResponse {
  ok: boolean
  status: number
  url: string
  headers: Headers
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}

export interface BrokerInit {
  method?: "GET" | "HEAD" | "POST"
  headers?: Record<string, string>
  body?: string
  /** Default 10 000 ms. */
  timeoutMs?: number
  /** Default 5 MB. */
  maxBytes?: number
  /** Default true. When false, a 3xx response is returned as is instead of followed. */
  followRedirects?: boolean
}

/** What `load` receives. There is no other way to reach the network or the environment. */
export interface PluginContext<Options, Secrets> {
  options: Options
  secrets: Secrets
  /** fetch limited to the hosts the plugin declared for these options. */
  fetch(url: string | URL, init?: BrokerInit): Promise<BrokerResponse>
  widget: { page: string; id: string }
  signal: AbortSignal
}

type AnyObject = z.ZodObject<z.ZodRawShape>

export interface PluginDefinition<O extends AnyObject = AnyObject, S extends AnyObject = AnyObject, D = unknown> {
  /** Matches `type:` in the page config. Lowercase, dashes. */
  id: string
  name: string
  description: string
  /** Options as written in YAML next to `type`. Validated strictly, so typos fail with a line number. */
  options: O
  /** Secret fields. Config must give each one as `env:NAME`; literal values fail validation. */
  secrets?: S
  /** Host names `ctx.fetch` may reach for these options. Anything else is refused. */
  hosts?: (options: z.infer<O>) => string[]
  /** Origins the view may load images from (added to the page's Content-Security-Policy). */
  imageHosts?: (options: z.infer<O>) => string[]
  /** Default refresh interval, e.g. "30s", "5m", "1h", or "never". */
  refresh?: string
  load: (ctx: PluginContext<z.infer<O>, z.infer<S>>) => Promise<D> | D
}

export function definePlugin<
  O extends AnyObject,
  S extends AnyObject = z.ZodObject<Record<string, never>>,
  D = unknown,
>(def: PluginDefinition<O, S, D>): PluginDefinition<O, S, D> {
  return def
}

/** Props every widget view receives. `data` is whatever the plugin's `load` returned. */
export interface ViewProps<P> {
  data: P extends PluginDefinition<AnyObject, AnyObject, infer D> ? Awaited<D> : P
}

/** Host name of a URL option, for `hosts`. */
export function hostOf(url: string | undefined): string[] {
  if (!url) return []
  try {
    return [new URL(url).host]
  } catch {
    return []
  }
}
