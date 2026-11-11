"use client"

import * as React from "react"

/*
 * Dashboard-only kit pieces. Layout and text primitives (Stack, Row, Grid,
 * Text, Heading, Metric, MetricGroup, MediaItem, ShowMore) come from
 * harebear-ui, sealed in ../index.ts.
 */

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ")
}

const gap = { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-3", lg: "gap-4", xl: "gap-6" } as const

export interface LinkProps {
  href: string
  /** Default true for absolute URLs. */
  newTab?: boolean
  tone?: "default" | "muted"
  children?: React.ReactNode
  title?: string
}

/** Inline link that inherits text styles and underlines on hover. */
export function Link({ href, newTab, tone: t = "default", children, title }: LinkProps) {
  const external = newTab ?? /^https?:/.test(href)
  return (
    <a
      data-slot="link"
      href={href}
      title={title}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cx(
        "min-w-0 underline-offset-4 outline-none hover:underline focus-visible:underline",
        t === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </a>
  )
}

export interface IconImageProps {
  /** From the plugin: { src, mono }. Mono icons are inverted in dark mode. */
  icon?: { src: string; mono: boolean }
  /** Shown as a letter when there is no icon. */
  fallback?: string
  size?: "sm" | "md"
}

/** A remote icon (simple-icons, dashboard-icons or a URL) or a letter. */
export function IconImage({ icon, fallback, size: s = "md" }: IconImageProps) {
  const box = s === "sm" ? "size-4" : "size-5"
  if (icon) {
    return (
      <img
        src={icon.src}
        alt=""
        loading="lazy"
        className={cx("shrink-0 object-contain", box, icon.mono && "dark:invert")}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-sm bg-primary-soft text-[10px] font-semibold text-primary uppercase",
        box,
      )}
    >
      {fallback?.slice(0, 1)}
    </span>
  )
}

export interface ListProps {
  /** Lines between items. */
  divided?: boolean
  gap?: keyof typeof gap
  children?: React.ReactNode
}

export function List({ divided, gap: g = "sm", children }: ListProps) {
  return (
    <ul data-slot="list" className={cx("flex min-w-0 flex-col", divided ? "divide-y divide-border" : gap[g])}>
      {React.Children.toArray(children).map((child, i) => (
        <li key={i} className={cx("min-w-0", divided && "py-2 first:pt-0 last:pb-0")}>
          {child}
        </li>
      ))}
    </ul>
  )
}
