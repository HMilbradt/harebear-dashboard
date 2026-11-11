/*
 * harebear-dashboard plugin SDK.
 *
 * Views build only from these components. None of them accept className or
 * style, so a plugin needs no CSS and always matches the theme.
 */
import * as UI from "harebear-ui"
import type * as React from "react"
import { type ComponentType, createElement } from "react"

export * from "./kit/layout"
export { z } from "zod"
export { definePlugin, hostOf } from "./plugin"
export type { BrokerInit, BrokerResponse, PluginContext, PluginDefinition, ViewProps } from "./plugin"

type Sealed<P> = Omit<P, "className" | "style">

/** Wrap a component so className and style are refused (types) and dropped (runtime). */
export function seal<P extends object>(component: ComponentType<P>, name: string) {
  // biome-ignore lint/correctness/noComponentHookFactories: called once per component at module scope
  function SealedComponent(props: Sealed<P>) {
    const { className, style, ...rest } = props as Record<string, unknown>
    if ((className !== undefined || style !== undefined) && import.meta.env?.DEV) {
      console.warn(`[harebear-dashboard] ${name}: className and style are ignored in widget views`)
    }
    return createElement(component, rest as P)
  }
  SealedComponent.displayName = name
  return SealedComponent
}

export const Badge = seal(UI.Badge, "Badge")
export const StatusBadge = seal(UI.StatusBadge, "StatusBadge")
export const StatusDot = seal(UI.StatusDot, "StatusDot")
export const LinkTile = seal(UI.LinkTile, "LinkTile")
export const KeyValueGrid = seal(UI.KeyValueGrid, "KeyValueGrid")
export const UsageMeter = seal(UI.UsageMeter, "UsageMeter")
export const BarList = seal(UI.BarList, "BarList")
export const Sparkline = seal(UI.Sparkline, "Sparkline")
export const Skeleton = seal(UI.Skeleton, "Skeleton")
export const Stack = seal(UI.Stack, "Stack")
export const Row = seal(UI.Row, "Row")
export const Text = seal(UI.Text, "Text")
export const Heading = seal(UI.Heading, "Heading")
export const Metric = seal(UI.Metric, "Metric")
export const MetricGroup = seal(UI.MetricGroup, "MetricGroup")
export const MediaItem = seal(UI.MediaItem, "MediaItem")
export const ShowMore = seal(UI.ShowMore, "ShowMore")
/** Breakpoints follow the widget's width: sm >= 28rem, md >= 42rem, lg >= 56rem. */
export const Grid = seal(
  (props: Omit<React.ComponentProps<typeof UI.Grid>, "query">) =>
    createElement(UI.Grid, { ...props, query: "container" }),
  "Grid",
)
export type { StatusTone } from "harebear-ui"
