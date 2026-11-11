const units = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const

export const DURATION_RE = /^(\d+)(ms|s|m|h|d)$/

/** "30s" -> 30000. "never" -> 0. */
export function parseDuration(value: string): number {
  if (value === "never") return 0
  const m = DURATION_RE.exec(value)
  if (!m) throw new Error(`Invalid duration "${value}". Use a number and a unit, like 30s, 5m, 1h.`)
  return Number(m[1]) * units[m[2] as keyof typeof units]
}
