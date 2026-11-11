/** "3h ago" relative to `now`. Both are epoch ms, so server and browser render the same text. */
export function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 60) return `${d}d ago`
  return `${Math.round(d / 30)}mo ago`
}
