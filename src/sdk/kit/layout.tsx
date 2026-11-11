"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import * as React from "react"

/*
 * Layout and text primitives for widget views. Props only, no className:
 * every class string lives here as a complete literal so Tailwind finds it.
 * Responsive values follow the widget's own width (container queries), not
 * the viewport: sm >= 28rem, md >= 42rem, lg >= 56rem.
 */

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ")
}

export type Space = "none" | "xs" | "sm" | "md" | "lg" | "xl"
const gap: Record<Space, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
  xl: "gap-6",
}

export type Align = "start" | "center" | "end" | "stretch" | "baseline"
const items: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
}

export type Justify = "start" | "center" | "end" | "between"
const justify: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
}

export interface StackProps {
  gap?: Space
  align?: Align
  children?: React.ReactNode
}

/** Vertical stack. */
export function Stack({ gap: g = "md", align = "stretch", children }: StackProps) {
  return (
    <div data-slot="stack" className={cx("flex min-w-0 flex-col", gap[g], items[align])}>
      {children}
    </div>
  )
}

export interface RowProps {
  gap?: Space
  align?: Align
  justify?: Justify
  wrap?: boolean
  children?: React.ReactNode
}

/** Horizontal row. */
export function Row({ gap: g = "sm", align = "center", justify: j = "start", wrap, children }: RowProps) {
  return (
    <div data-slot="row" className={cx("flex min-w-0", gap[g], items[align], justify[j], wrap && "flex-wrap")}>
      {children}
    </div>
  )
}

export type Cols = 1 | 2 | 3 | 4 | 5 | 6
export type ResponsiveCols = Cols | { base?: Cols; sm?: Cols; md?: Cols; lg?: Cols }

const colsBase: Record<Cols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
}
const colsSm: Record<Cols, string> = {
  1: "@md:grid-cols-1",
  2: "@md:grid-cols-2",
  3: "@md:grid-cols-3",
  4: "@md:grid-cols-4",
  5: "@md:grid-cols-5",
  6: "@md:grid-cols-6",
}
const colsMd: Record<Cols, string> = {
  1: "@2xl:grid-cols-1",
  2: "@2xl:grid-cols-2",
  3: "@2xl:grid-cols-3",
  4: "@2xl:grid-cols-4",
  5: "@2xl:grid-cols-5",
  6: "@2xl:grid-cols-6",
}
const colsLg: Record<Cols, string> = {
  1: "@4xl:grid-cols-1",
  2: "@4xl:grid-cols-2",
  3: "@4xl:grid-cols-3",
  4: "@4xl:grid-cols-4",
  5: "@4xl:grid-cols-5",
  6: "@4xl:grid-cols-6",
}

export interface GridProps {
  cols?: ResponsiveCols
  gap?: Space
  children?: React.ReactNode
}

/** Grid with equal columns. `cols={{ base: 1, sm: 2, md: 3 }}` adapts to the widget's width. */
export function Grid({ cols = 2, gap: g = "md", children }: GridProps) {
  const c = typeof cols === "number" ? { base: cols } : cols
  return (
    <div
      data-slot="grid"
      className={cx(
        "grid min-w-0",
        gap[g],
        colsBase[c.base ?? 1],
        c.sm && colsSm[c.sm],
        c.md && colsMd[c.md],
        c.lg && colsLg[c.lg],
      )}
    >
      {children}
    </div>
  )
}

export type Tone = "default" | "muted" | "success" | "warning" | "danger" | "info"
const tone: Record<Tone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-primary",
}
const size = { xs: "text-xs", sm: "text-[13px]", base: "text-sm", lg: "text-base", xl: "text-xl", "2xl": "text-2xl" }
const weight = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" }
const clamp = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" }

export interface TextProps {
  size?: keyof typeof size
  tone?: Tone
  weight?: keyof typeof weight
  mono?: boolean
  /** Single line with an ellipsis. */
  truncate?: boolean
  /** Clamp to this many lines. */
  lines?: 1 | 2 | 3
  tabular?: boolean
  as?: "span" | "p" | "div"
  title?: string
  children?: React.ReactNode
}

export function Text({
  size: s = "base",
  tone: t = "default",
  weight: w = "normal",
  mono,
  truncate,
  lines,
  tabular,
  as: As = "span",
  title,
  children,
}: TextProps) {
  return (
    <As
      data-slot="text"
      title={title}
      className={cx(
        "min-w-0",
        size[s],
        tone[t],
        weight[w],
        mono && "font-mono",
        truncate && "block truncate",
        lines && clamp[lines],
        tabular && "tabular-nums",
      )}
    >
      {children}
    </As>
  )
}

export interface HeadingProps {
  /** 3 for a section in a widget, 4 for a small label above a group. */
  level?: 3 | 4
  children?: React.ReactNode
}

export function Heading({ level = 3, children }: HeadingProps) {
  return level === 3 ? (
    <h3 data-slot="heading" className="text-sm font-semibold">
      {children}
    </h3>
  ) : (
    <h4 data-slot="heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h4>
  )
}

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

export interface MetricProps {
  label: React.ReactNode
  value: React.ReactNode
  unit?: React.ReactNode
  /** Percent change. Positive is good unless `lowerIsBetter`. */
  delta?: number
  lowerIsBetter?: boolean
  align?: "start" | "center"
}

/** A number with a label and an optional change, e.g. download speed vs. average. */
export function Metric({ label, value, unit, delta, lowerIsBetter, align = "center" }: MetricProps) {
  const good = delta === undefined || delta === 0 ? undefined : lowerIsBetter ? delta < 0 : delta > 0
  return (
    <div
      data-slot="metric"
      className={cx("flex min-w-0 flex-col gap-0.5", align === "center" ? "items-center text-center" : "items-start")}
    >
      {delta !== undefined && Number.isFinite(delta) && (
        <span
          className={cx(
            "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
            good === undefined ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%
          {delta > 0 ? (
            <ArrowUpRight aria-hidden className="size-3.5" />
          ) : delta < 0 ? (
            <ArrowDownRight aria-hidden className="size-3.5" />
          ) : null}
        </span>
      )}
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </span>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  )
}

/** Metrics side by side, evenly spaced. */
export function MetricGroup({ children }: { children?: React.ReactNode }) {
  return (
    <div data-slot="metric-group" className="grid auto-cols-fr grid-flow-col gap-3">
      {children}
    </div>
  )
}

export interface MediaItemProps {
  title: React.ReactNode
  href?: string
  /** Image URL. Its host must be declared in the plugin's imageHosts. */
  image?: string
  imageShape?: "poster" | "square" | "wide"
  meta?: React.ReactNode
  description?: React.ReactNode
}

/** Thumbnail, title, meta line and description. For media, articles, releases. */
export function MediaItem({ title, href, image, imageShape = "poster", meta, description }: MediaItemProps) {
  const shape =
    imageShape === "poster" ? "aspect-[2/3] w-14" : imageShape === "square" ? "aspect-square w-12" : "aspect-video w-24"
  const img = image ? (
    <img src={image} alt="" loading="lazy" className={cx("shrink-0 rounded-md bg-muted object-cover", shape)} />
  ) : null
  return (
    <div data-slot="media-item" className="flex min-w-0 items-start gap-3">
      {img && href ? (
        <a href={href} target="_blank" rel="noreferrer" tabIndex={-1} className="shrink-0">
          {img}
        </a>
      ) : (
        img
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 font-medium">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="outline-none hover:underline focus-visible:underline"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </span>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        {description && <span className="line-clamp-2 text-[13px] text-muted-foreground">{description}</span>}
      </div>
    </div>
  )
}

export interface ShowMoreProps {
  /** Items shown before the "Show more" button. Default 5. */
  initial?: number
  gap?: Space
  children?: React.ReactNode
}

/** A list that collapses after `initial` children. */
export function ShowMore({ initial = 5, gap: g = "md", children }: ShowMoreProps) {
  const [open, setOpen] = React.useState(false)
  const all = React.Children.toArray(children)
  const shown = open ? all : all.slice(0, initial)
  return (
    <div data-slot="show-more" className={cx("flex min-w-0 flex-col", gap[g])}>
      {shown}
      {all.length > initial && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="self-start rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          {open ? "Show less" : `Show ${all.length - initial} more`}
        </button>
      )}
    </div>
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
  gap?: Space
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
