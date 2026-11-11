import { z } from "zod"

const SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@16.37.0/icons/"
const DASHBOARD_ICONS = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/"

export const iconOption = z
  .string()
  .regex(/^(si:|di:|https:\/\/)/, "Use si:<name> (simple-icons), di:<name> (dashboard-icons) or an https URL")
  .describe("si:<simple-icons slug>, di:<dashboard-icons name>, or an https image URL")

export interface ResolvedIcon {
  src: string
  /** Single-color icon: inverted in dark mode. */
  mono: boolean
}

export function resolveIcon(icon: string | undefined): ResolvedIcon | undefined {
  if (!icon) return undefined
  if (icon.startsWith("si:")) return { src: `${SIMPLE_ICONS}${encodeURIComponent(icon.slice(3))}.svg`, mono: true }
  if (icon.startsWith("di:")) return { src: `${DASHBOARD_ICONS}${encodeURIComponent(icon.slice(3))}.svg`, mono: false }
  if (icon.startsWith("https://")) return { src: icon, mono: false }
  return undefined
}

/** Origins for the CSP img-src of a set of icon options. */
export function iconHosts(icons: (string | undefined)[]): string[] {
  const hosts = new Set<string>()
  for (const icon of icons) {
    const r = resolveIcon(icon)
    if (r) hosts.add(new URL(r.src).origin)
  }
  return [...hosts]
}
