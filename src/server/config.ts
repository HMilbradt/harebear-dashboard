import "@tanstack/react-start/server-only"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { LineCounter, parseDocument } from "yaml"
import { z } from "zod"
import { iconOption } from "@/plugins/_shared/icons"
import { DURATION_RE, parseDuration } from "./duration"
import { localPlugin } from "./local-plugins"
import { getPlugin, pluginTypes } from "./registry"

/* ---------- schemas ---------- */

const ENV_REF_RE = /^env:[A-Za-z_][A-Za-z0-9_]*$/
const envRef = z.string().regex(ENV_REF_RE, "Secrets must be env:NAME references, never literal values")
const duration = z.union([z.literal("never"), z.string().regex(DURATION_RE, "Use a duration like 30s, 5m, 1h")])
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes")

export const dashboardSchema = z
  .object({
    title: z.string().default("Dashboard"),
    theme: z
      .object({
        accent: z.string().optional().describe("Any CSS color, e.g. #2f5bd3"),
        radius: z.number().min(0).max(32).optional().describe("Base corner radius in px"),
        mode: z.enum(["system", "light", "dark"]).default("system"),
      })
      .strict()
      .default({ mode: "system" }),
    auth: z
      .object({
        mode: z
          .enum(["none", "password", "proxy"])
          .default("none")
          .describe(
            "none: anyone who can reach it; password: one password; proxy: trust a header from your auth proxy",
          ),
        passwordHash: envRef
          .optional()
          .describe("env:NAME holding the output of `harebear-dashboard hash-password`. Required for mode: password"),
        proxy: z
          .object({
            header: z.string().default("Remote-User").describe("Header carrying the signed-in user"),
            trustedProxies: z
              .array(z.string())
              .default([])
              .describe("IPv4 CIDRs or IPv6 addresses the header is accepted from"),
          })
          .strict()
          .default({ header: "Remote-User", trustedProxies: [] }),
      })
      .strict()
      .default({ mode: "none", proxy: { header: "Remote-User", trustedProxies: [] } })
      .superRefine((a, ctx) => {
        if (a.mode === "password" && !a.passwordHash) {
          ctx.addIssue({
            code: "custom",
            path: ["passwordHash"],
            message: "mode: password needs passwordHash: env:NAME",
          })
        }
        if (a.mode === "proxy" && !a.proxy.trustedProxies.length) {
          ctx.addIssue({
            code: "custom",
            path: ["proxy", "trustedProxies"],
            message: "mode: proxy needs at least one trusted proxy address",
          })
        }
      }),
    header: z
      .object({
        title: z.string().optional().describe("Text next to the icon. Default: the dashboard title"),
        showTitle: z.boolean().default(true).describe("Show the text next to the icon"),
        icon: z
          .union([z.literal("default"), z.literal("none"), iconOption])
          .default("default")
          .describe("default (the harebear mark), none, or si:/di:/https icon"),
        homeInNav: z
          .boolean()
          .default(true)
          .describe("Also list the home page (the first page) as a tab. The icon always links home."),
      })
      .strict()
      .default({ showTitle: true, icon: "default", homeInNav: true }),
    search: z
      .object({
        engine: z
          .string()
          .default("duckduckgo")
          .describe("duckduckgo, google, bing, kagi, startpage, or a URL with {q}"),
        bangs: z
          .array(
            z
              .object({
                shortcut: z.string().min(1).describe("Typed before the query, e.g. !yt"),
                url: z.string().includes("{q}"),
                title: z.string().optional(),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({ engine: "duckduckgo", bangs: [] }),
  })
  .strict()

export type DashboardConfig = z.infer<typeof dashboardSchema>

const BASE_KEYS = ["id", "type", "title", "titleUrl", "refresh", "hideHeader", "secrets"] as const

const widgetBase = z.object({
  id: slug.describe("Stable id, unique on the page. Used in URLs and the API."),
  type: z.string(),
  title: z.string().optional(),
  titleUrl: z.union([z.url(), envRef]).optional(),
  refresh: duration.optional(),
  hideHeader: z.boolean().optional(),
  secrets: z.record(z.string(), envRef).optional(),
})

const containerSchema = z
  .object({
    type: z.enum(["group", "split"]),
    id: slug.optional(),
    title: z.string().optional(),
    widgets: z.array(z.unknown()).min(1),
  })
  .strict()

const pageSchema = z
  .object({
    title: z.string(),
    order: z.number().default(100),
    width: z.enum(["slim", "default", "wide"]).default("default"),
    center: z.boolean().default(false).describe("Center the page vertically (start-page style)"),
    columns: z
      .array(
        z
          .object({
            size: z.enum(["small", "full"]).default("full"),
            widgets: z.array(z.unknown()).default([]),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict()

/* ---------- resolved shapes ---------- */

export interface WidgetConfig {
  page: string
  id: string
  type: string
  title: string
  titleUrl?: string
  refreshMs: number
  hideHeader: boolean
  options: Record<string, unknown>
  secretRefs: Record<string, string>
}

export type LayoutNode =
  | { kind: "widget"; id: string }
  | { kind: "group"; title?: string; children: LayoutNode[] }
  | { kind: "split"; children: LayoutNode[] }

export interface PageConfig {
  slug: string
  title: string
  order: number
  width: "slim" | "default" | "wide"
  center: boolean
  columns: { size: "small" | "full"; nodes: LayoutNode[] }[]
  widgets: Map<string, WidgetConfig>
}

export interface LoadedConfig {
  dashboard: DashboardConfig
  pages: PageConfig[]
}

export interface ConfigError {
  file: string
  line?: number
  path: string
  message: string
}

/* ---------- loading ---------- */

interface Source {
  file: string
  data: unknown
  locate: (p: PropertyKey[]) => number | undefined
}

async function readYaml(dir: string, rel: string, errors: ConfigError[]): Promise<Source | undefined> {
  let text: string
  try {
    text = await readFile(path.join(dir, rel), "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw err
  }
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, { lineCounter, prettyErrors: false })
  if (doc.errors.length) {
    for (const e of doc.errors) {
      errors.push({ file: rel, line: e.linePos?.[0].line, path: "", message: e.message.split("\n")[0] ?? e.message })
    }
    return undefined
  }
  // Line of the deepest node on the path that exists (a missing key points at its parent).
  const locate = (p: PropertyKey[]) => {
    for (let i = p.length; i >= 0; i--) {
      const node = doc.getIn(p.slice(0, i), true) as { range?: [number, number, number] } | undefined
      if (node?.range) return lineCounter.linePos(node.range[0]).line
    }
    return undefined
  }
  return { file: rel, data: doc.toJS() ?? {}, locate }
}

function pathString(p: PropertyKey[]): string {
  return p.reduce<string>((s, k) => (typeof k === "number" ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), "")
}

function pushIssues(errors: ConfigError[], src: Source, base: PropertyKey[], issues: z.core.$ZodIssue[]) {
  for (const issue of issues) {
    const p = [...base, ...issue.path]
    let message = issue.message
    let line = src.locate(p)
    if (issue.code === "unrecognized_keys") {
      message = `Unknown key${issue.keys.length > 1 ? "s" : ""}: ${issue.keys.join(", ")}`
      line = src.locate([...p, issue.keys[0]!]) ?? line
    }
    errors.push({ file: src.file, line, path: pathString(p), message })
  }
}

export async function loadConfig(dir: string): Promise<{ config?: LoadedConfig; errors: ConfigError[] }> {
  const errors: ConfigError[] = []

  const dashSrc = await readYaml(dir, "dashboard.yaml", errors)
  let dashboard = dashboardSchema.parse({})
  if (dashSrc) {
    const parsed = dashboardSchema.safeParse(dashSrc.data)
    if (parsed.success) dashboard = parsed.data
    else pushIssues(errors, dashSrc, [], parsed.error.issues)
  }

  let files: string[] = []
  try {
    files = (await readdir(path.join(dir, "pages"))).filter((f) => /\.ya?ml$/.test(f)).sort()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  const pages: PageConfig[] = []
  for (const file of files) {
    const rel = `pages/${file}`
    const src = await readYaml(dir, rel, errors)
    if (!src) continue
    const pageSlug = file.replace(/\.ya?ml$/, "")
    if (!/^[a-z0-9][a-z0-9-]*$/.test(pageSlug)) {
      errors.push({
        file: rel,
        path: "",
        message: "Page file names become URLs: use lowercase letters, digits and dashes",
      })
      continue
    }
    const parsed = pageSchema.safeParse(src.data)
    if (!parsed.success) {
      pushIssues(errors, src, [], parsed.error.issues)
      continue
    }
    const p = parsed.data
    if (!p.columns.some((c) => c.size === "full")) {
      errors.push({
        file: rel,
        line: src.locate(["columns"]),
        path: "columns",
        message: "A page needs at least one full column",
      })
    }
    const widgets = new Map<string, WidgetConfig>()
    const columns = p.columns.map((col, ci) => ({
      size: col.size,
      nodes: col.widgets
        .map((w, wi) => parseNode(w, ["columns", ci, "widgets", wi], src, pageSlug, widgets, errors))
        .filter((n): n is LayoutNode => !!n),
    }))
    pages.push({
      slug: pageSlug,
      title: p.title,
      order: p.order,
      width: p.width,
      center: p.center,
      columns,
      widgets,
    })
  }
  pages.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))

  if (errors.length) return { errors }
  return { config: { dashboard, pages }, errors }
}

function parseNode(
  raw: unknown,
  at: PropertyKey[],
  src: Source,
  page: string,
  widgets: Map<string, WidgetConfig>,
  errors: ConfigError[],
): LayoutNode | undefined {
  const type = (raw as { type?: unknown } | null)?.type
  if (type === "group" || type === "split") {
    const parsed = containerSchema.safeParse(raw)
    if (!parsed.success) {
      pushIssues(errors, src, at, parsed.error.issues)
      return undefined
    }
    const children = parsed.data.widgets
      .map((w, i) => parseNode(w, [...at, "widgets", i], src, page, widgets, errors))
      .filter((n): n is LayoutNode => !!n)
    return type === "group" ? { kind: "group", title: parsed.data.title, children } : { kind: "split", children }
  }

  const base = widgetBase.loose().safeParse(raw)
  if (!base.success) {
    pushIssues(errors, src, at, base.error.issues)
    return undefined
  }
  const w = base.data
  const plugin = getPlugin(w.type)
  if (!plugin) {
    const broken = localPlugin(w.type)?.error
    errors.push({
      file: src.file,
      line: src.locate([...at, "type"]),
      path: pathString([...at, "type"]),
      message: broken
        ? `Plugin "${w.type}" failed to build: ${broken}`
        : `Unknown widget type "${w.type}". Available: ${[...pluginTypes(), "group", "split"].join(", ")}`,
    })
    return undefined
  }
  if (widgets.has(w.id)) {
    errors.push({
      file: src.file,
      line: src.locate([...at, "id"]),
      path: pathString([...at, "id"]),
      message: `Duplicate widget id "${w.id}" on this page`,
    })
    return undefined
  }

  // Options may use env:NAME for any value (a URL, a location). Resolve before validating.
  let rest: Record<string, unknown>
  let titleUrl: string | undefined
  try {
    rest = resolveEnv(
      Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).filter(([k]) => !(BASE_KEYS as readonly string[]).includes(k)),
      ),
      pathString(at),
    )
    titleUrl = w.titleUrl && resolveEnv(w.titleUrl, pathString([...at, "titleUrl"]))
  } catch (err) {
    errors.push({ file: src.file, line: src.locate(at), path: pathString(at), message: (err as Error).message })
    return undefined
  }
  const opts = plugin.options.strict().safeParse(rest)
  if (!opts.success) {
    pushIssues(errors, src, at, opts.error.issues)
    return undefined
  }

  const secretRefs = w.secrets ?? {}
  const declared = plugin.secrets?.shape ?? {}
  const openSecrets = !!(plugin.secrets as { _zod?: { def?: { catchall?: unknown } } } | undefined)?._zod?.def?.catchall
  for (const key of Object.keys(secretRefs)) {
    if (!openSecrets && !(key in declared)) {
      errors.push({
        file: src.file,
        line: src.locate([...at, "secrets", key]),
        path: pathString([...at, "secrets", key]),
        message: `"${w.type}" has no secret named ${key}. Declared: ${Object.keys(declared).join(", ") || "none"}`,
      })
    }
  }
  for (const [key, schema] of Object.entries(declared)) {
    if (!(key in secretRefs) && !(schema as z.ZodType).safeParse(undefined).success) {
      errors.push({
        file: src.file,
        line: src.locate(at),
        path: pathString([...at, "secrets"]),
        message: `"${w.type}" needs secrets.${key}: env:NAME`,
      })
    }
  }

  const refresh = w.refresh ?? plugin.refresh ?? "5m"
  widgets.set(w.id, {
    page,
    id: w.id,
    type: w.type,
    title: w.title ?? plugin.name,
    titleUrl,
    refreshMs: parseDuration(refresh),
    hideHeader: w.hideHeader ?? false,
    options: opts.data,
    secretRefs,
  })
  return { kind: "widget", id: w.id }
}

/** Replace `env:NAME` strings with the variable's value. Throws if one is unset. */
export function resolveEnv<T>(value: T, where: string): T {
  if (typeof value === "string" && ENV_REF_RE.test(value)) {
    const name = value.slice(4)
    const v = process.env[name]
    if (v === undefined || v === "") throw new Error(`${where}: environment variable ${name} is not set`)
    return v as T
  }
  if (Array.isArray(value)) return value.map((v) => resolveEnv(v, where)) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveEnv(v, `${where}.${k}`)])) as T
  }
  return value
}
