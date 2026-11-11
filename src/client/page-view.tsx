import { ClientOnly, Link } from "@tanstack/react-router"
import { Callout, ThemeToggle, TooltipProvider } from "harebear-ui"
import { TriangleAlert } from "lucide-react"
import { useDashboard } from "@/client/dashboard-context"
import type { PageData } from "@/server/fns"
import { LayoutNodeView } from "./widget-host"

const widthClass = { slim: "max-w-5xl", default: "max-w-7xl", wide: "max-w-[1920px]" } as const

export function ConfigErrors() {
  const { errors } = useDashboard()
  if (!errors.length) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-3xl rounded-xl border bg-card shadow-card">
        <Callout icon={<TriangleAlert className="text-warning" />} tone="muted" className="rounded-xl">
          <p className="font-semibold">
            Config has {errors.length === 1 ? "an error" : `${errors.length} errors`}. Showing the last version that
            worked.
          </p>
          <ul className="mt-1.5 flex max-h-48 flex-col gap-1 overflow-auto font-mono text-xs">
            {errors.map((e, i) => (
              <li key={i}>
                {e.file}
                {e.line ? `:${e.line}` : ""} {e.path && <span className="text-muted-foreground">{e.path}</span>}{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </Callout>
      </div>
    </div>
  )
}

function Nav({ active }: { active: string }) {
  const { pages, header, auth } = useDashboard()
  const home = pages[0]?.slug
  const tabs = header.homeInNav ? pages : pages.slice(1)
  const brandOnly = !header.showTitle
  return (
    <header className="mx-auto flex w-full items-center gap-4 px-4 pt-4 sm:px-6">
      {(header.icon || header.showTitle) && (
        <Link
          to="/"
          aria-label={brandOnly ? `${header.title} (home)` : undefined}
          className="-mx-1 flex shrink-0 items-center gap-2 rounded-md px-1 py-1 font-semibold outline-none hover:opacity-80 focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          {header.icon && (
            <img src={header.icon.src} alt="" className={header.icon.mono ? "size-7 dark:invert" : "size-7"} />
          )}
          {header.showTitle && header.title}
        </Link>
      )}
      <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {tabs.map((p) => (
          <Link
            key={p.slug}
            to={p.slug === home ? "/" : "/$page"}
            params={p.slug === home ? {} : { page: p.slug }}
            className={
              p.slug === active
                ? "rounded-md bg-primary-soft px-3 py-1.5 text-sm font-medium whitespace-nowrap text-primary"
                : "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          >
            {p.title}
          </Link>
        ))}
      </nav>
      {auth === "password" && (
        <form method="post" action="/logout">
          <button
            type="submit"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      )}
      {/* harebear-ui's ThemeToggle reads the stored mode on first render, so it cannot be server rendered. */}
      <ClientOnly fallback={<span className="size-9" />}>
        <ThemeToggle />
      </ClientOnly>
    </header>
  )
}

export function PageView({ page }: { page: PageData }) {
  const { version } = useDashboard()
  const template = page.columns.map((c) => (c.size === "small" ? "20rem" : "minmax(0, 1fr)")).join(" ")
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col">
        <div className={`mx-auto w-full ${widthClass[page.width]}`}>
          <Nav active={page.slug} />
        </div>
        <main
          className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:px-6 ${widthClass[page.width]} ${page.center ? "justify-center" : ""}`}
        >
          <div
            className="flex flex-col gap-4 lg:grid lg:grid-cols-(--cols) lg:items-start"
            style={{ "--cols": template } as React.CSSProperties}
          >
            {page.columns.map((col, ci) => (
              <div key={ci} className="flex min-w-0 flex-col gap-4">
                {col.nodes.map((node, ni) => (
                  <LayoutNodeView key={ni} page={page.slug} version={version} node={node} initial={page.initial} />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
      <ConfigErrors />
    </TooltipProvider>
  )
}

export function EmptyState() {
  const { configDir, errors } = useDashboard()
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">No pages yet</h1>
      <p className="text-muted-foreground">
        Add a YAML file to <code className="font-mono text-foreground">{configDir}/pages/</code>. It loads as soon as
        you save it.
      </p>
      <pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">{`# pages/home.yaml
title: Home
width: slim
columns:
  - size: full
    widgets:
      - id: search
        type: search
      - id: clock
        type: clock`}</pre>
      {errors.length > 0 && <ConfigErrors />}
    </div>
  )
}
