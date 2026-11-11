import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { ConfigError, DashboardConfig, LayoutNode } from "./config"
import type { WidgetResult } from "./runner"

export type { WidgetResult }

export interface WidgetMeta {
  id: string
  type: string
  title: string
  titleUrl?: string
  refreshMs: number
  hideHeader: boolean
}

export type ClientNode =
  | { kind: "widget"; widget: WidgetMeta }
  | { kind: "group"; title?: string; children: ClientNode[] }
  | { kind: "split"; children: ClientNode[] }

export interface ShellData {
  title: string
  /** Auth mode, and whether this request is signed in. Signed-out shells carry no pages or errors. */
  auth: "none" | "password" | "proxy"
  signedIn: boolean
  header: { title: string; showTitle: boolean; icon: { src: string; mono: boolean } | null; homeInNav: boolean }
  theme: DashboardConfig["theme"]
  search: DashboardConfig["search"]
  pages: { slug: string; title: string }[]
  version: number
  errors: ConfigError[]
  configDir: string
}

export interface PageData {
  slug: string
  title: string
  width: "slim" | "default" | "wide"
  center: boolean
  columns: { size: "small" | "full"; nodes: ClientNode[] }[]
  initial: Record<string, WidgetResult>
}

const PREFETCH_DEADLINE = 1500

export const getShell = createServerFn({ method: "GET" }).handler(async (): Promise<ShellData> => {
  const { configStore } = await import("./store")
  const { dashboardSchema } = await import("./config")
  const { resolveIcon } = await import("@/plugins/_shared/icons")
  const { authorizeRequest } = await import("./session")
  const { getRequest } = await import("@tanstack/react-start/server")
  const s = await configStore().get()
  const dash = s.config?.dashboard ?? dashboardSchema.parse({})
  const signedIn = !!(await authorizeRequest(getRequest()))
  return {
    auth: dash.auth.mode,
    signedIn,
    title: dash.title,
    header: {
      title: dash.header.title ?? dash.title,
      showTitle: dash.header.showTitle,
      icon:
        dash.header.icon === "none"
          ? null
          : dash.header.icon === "default"
            ? { src: "/favicon.svg", mono: false }
            : (resolveIcon(dash.header.icon) ?? null),
      homeInNav: dash.header.homeInNav,
    },
    theme: dash.theme,
    search: dash.search,
    pages: signedIn ? (s.config?.pages.map((p) => ({ slug: p.slug, title: p.title })) ?? []) : [],
    version: s.version,
    errors: signedIn ? s.errors : [],
    configDir: signedIn ? s.dir : "",
  }
})

export const getPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().optional() }))
  .handler(async ({ data }): Promise<PageData | null> => {
    const { configStore } = await import("./store")
    const { widgetData } = await import("./runner")
    const s = await configStore().get()
    const page = data.slug ? s.config?.pages.find((p) => p.slug === data.slug) : s.config?.pages[0]
    if (!page) {
      if (!data.slug) return null
      throw notFound()
    }

    const toClient = (n: LayoutNode): ClientNode => {
      if (n.kind !== "widget") return { ...n, children: n.children.map(toClient) }
      const w = page.widgets.get(n.id)!
      return {
        kind: "widget",
        widget: {
          id: w.id,
          type: w.type,
          title: w.title,
          titleUrl: w.titleUrl,
          refreshMs: w.refreshMs,
          hideHeader: w.hideHeader,
        },
      }
    }

    // Prefetch every widget in parallel; send what is ready by the deadline, the rest load in the browser.
    const initial: Record<string, WidgetResult> = {}
    const all = Promise.all(
      [...page.widgets.values()].map((w) =>
        widgetData(w).then((r) => {
          initial[w.id] = r
        }),
      ),
    )
    await Promise.race([all, new Promise((r) => setTimeout(r, PREFETCH_DEADLINE))])

    return {
      slug: page.slug,
      title: page.title,
      width: page.width,
      center: page.center,
      columns: page.columns.map((c) => ({ size: c.size, nodes: c.nodes.map(toClient) })),
      initial: { ...initial },
    }
  })

export const getWidget = createServerFn({ method: "GET" })
  .validator(z.object({ page: z.string(), id: z.string() }))
  .handler(async ({ data }): Promise<WidgetResult> => {
    const { configStore } = await import("./store")
    const { widgetData } = await import("./runner")
    const s = await configStore().get()
    const w = s.config?.pages.find((p) => p.slug === data.page)?.widgets.get(data.id)
    if (!w) return { status: "error", error: "This widget is no longer in the config", updatedAt: Date.now() }
    return widgetData(w)
  })
