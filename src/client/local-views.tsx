import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import * as sdk from "@/sdk"

type View = React.ComponentType<{ data: unknown }>

const g = globalThis as { __harebear?: unknown; __harebearViews?: Map<string, View> }
g.__harebearViews ??= new Map()
const loaded = g.__harebearViews

// Local plugin view bundles import react, react/jsx-runtime and the SDK through these.
if (typeof window !== "undefined") g.__harebear = { React, jsxRuntime, sdk }

/** Server side: the compiler registers each built view so SSR can render it synchronously. */
export function registerLocalView(url: string, view: View) {
  loaded.set(url, view)
}

const lazies = new Map<string, View>()

/** The view for a local plugin bundle URL: already loaded on the server, lazy in the browser. */
export function localView(url: string): View {
  const ready = loaded.get(url)
  if (ready) return ready
  let lazy = lazies.get(url)
  if (!lazy) {
    lazy = React.lazy(async () => {
      const mod = (await import(/* @vite-ignore */ url)) as { default: View }
      loaded.set(url, mod.default)
      return mod
    })
    lazies.set(url, lazy)
  }
  return lazy
}
