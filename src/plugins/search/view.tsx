import { SearchInput } from "harebear-ui"
import * as React from "react"
import { useDashboard } from "@/client/dashboard-context"
import type { ViewProps } from "@/sdk"
import type plugin from "./server"

const ENGINES: Record<string, string> = {
  duckduckgo: "https://duckduckgo.com/?q={q}",
  google: "https://www.google.com/search?q={q}",
  bing: "https://www.bing.com/search?q={q}",
  kagi: "https://kagi.com/search?q={q}",
  startpage: "https://www.startpage.com/do/search?q={q}",
}

export default function SearchView({ data }: ViewProps<typeof plugin>) {
  const { search } = useDashboard()
  const ref = React.useRef<HTMLInputElement>(null)
  const engine = data.engine ?? search.engine
  const template = ENGINES[engine] ?? engine

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== "/" || t?.closest("input, textarea, [contenteditable]")) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = ref.current?.value.trim()
    if (!q) return
    let url = template
    let query = q
    const [first, ...rest] = q.split(/\s+/)
    const bang = search.bangs.find((b) => b.shortcut === first)
    if (bang) {
      url = bang.url
      query = rest.join(" ")
    }
    const target = url.replace("{q}", encodeURIComponent(query))
    if (data.newTab) window.open(target, "_blank", "noopener")
    else window.location.href = target
  }

  return (
    <form onSubmit={submit} role="search">
      <SearchInput
        ref={ref}
        size="lg"
        name="q"
        placeholder={data.placeholder}
        autoFocus={data.autofocus}
        autoComplete="off"
        shortcut="/"
      />
    </form>
  )
}
