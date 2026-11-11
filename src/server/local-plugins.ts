import "@tanstack/react-start/server-only"
import { createHash } from "node:crypto"
import { watch } from "node:fs"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import * as esbuild from "esbuild"
import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import { z } from "zod"
import { registerLocalView } from "@/client/local-views"
import { builtinPlugins } from "@/plugins/server"
import * as sdk from "@/sdk"
import { definePlugin, hostOf, type PluginDefinition } from "@/sdk/plugin"

/*
 * Local code plugins: PLUGINS_DIR/<id>/server.ts and view.tsx, compiled with
 * esbuild at startup and whenever a file changes. Trusted code, with
 * guardrails: banned imports, shadowed network and process globals, output
 * validated by the host. Never loaded from a URL.
 */

export interface LocalPlugin {
  id: string
  hash: string
  plugin?: PluginDefinition
  viewUrl?: string
  error?: string
}

const g = globalThis as {
  __harebear?: unknown
  __harebearServer?: unknown
  __harebearLocal?: Map<string, LocalPlugin>
  __harebearLocalStarted?: boolean
}

// What the shims hand to plugin bundles (same instances the host renders with).
g.__harebear = { React, jsxRuntime, sdk }
g.__harebearServer = { definePlugin, hostOf, z }
g.__harebearLocal ??= new Map()
const local = g.__harebearLocal

export const PLUGINS_DIR = path.resolve(process.env.PLUGINS_DIR ?? "plugins")
const BUILD_DIR = path.join(os.tmpdir(), "harebear-dashboard-plugins")

export function localPlugin(id: string): LocalPlugin | undefined {
  return local.get(id)
}

export function localPlugins(): LocalPlugin[] {
  return [...local.values()]
}

export function builtFile(id: string, file: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(id) || !/^view\.[0-9a-f]{12}\.mjs$/.test(file)) return undefined
  return path.join(BUILD_DIR, id, file)
}

/* ---------- shims and guardrails ---------- */

const BANNED_MODULES =
  /^(node:|fs$|fs\/|child_process|net$|tls$|http$|https$|http2$|dgram$|dns$|os$|path$|vm$|worker_threads|cluster$|module$|process$)/
const BANNED_SOURCE: [RegExp, string][] = [
  [/\beval\s*\(/, "eval"],
  [/\bnew\s+Function\s*\(/, "new Function"],
  [/\brequire\s*\(/, "require()"],
  [/\bimport\s*\(/, "dynamic import()"],
  [/dangerouslySetInnerHTML/, "dangerouslySetInnerHTML"],
  [/\bprocess\s*\./, "process"],
  [/\bglobalThis\b/, "globalThis"],
]

// Shadow globals a plugin must not use. ctx.fetch, destructured inside load, still works.
const SERVER_BANNER = `const __hbd = globalThis.__harebearServer;
const fetch = void 0, process = void 0, require = void 0, XMLHttpRequest = void 0, WebSocket = void 0, global = void 0;`
const VIEW_BANNER = `const __hbd = globalThis.__harebear;
const fetch = void 0, XMLHttpRequest = void 0, WebSocket = void 0, EventSource = void 0, process = void 0, window = void 0, self = void 0, document = void 0, localStorage = void 0;`

function namedExports(mod: object, source: string) {
  const keys = Object.keys(mod).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== "default")
  return `const __m = ${source};\nexport default __m;\nexport const { ${keys.join(", ")} } = __m;`
}

function shimPlugin(kind: "server" | "view"): esbuild.Plugin {
  const modules: Record<string, string> =
    kind === "server"
      ? {
          "harebear-dashboard/sdk": "export const { definePlugin, hostOf, z } = __hbd;",
          zod: "export const { z } = __hbd; export default __hbd.z;",
        }
      : {
          react: namedExports(React, "__hbd.React"),
          "react/jsx-runtime": "export const { jsx, jsxs, Fragment } = __hbd.jsxRuntime;",
          "harebear-dashboard/sdk": namedExports(sdk, "__hbd.sdk"),
        }
  return {
    name: `harebear-${kind}-shims`,
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path in modules) return { path: args.path, namespace: "hbd-shim" }
        if (BANNED_MODULES.test(args.path)) {
          return { errors: [{ text: `"${args.path}" is not allowed in a plugin. Use ctx.fetch and ctx.options.` }] }
        }
        if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
          return {
            errors: [
              {
                text: `"${args.path}" is not available to plugins. Import from "harebear-dashboard/sdk"${kind === "server" ? ' or "zod"' : ' or "react"'}.`,
              },
            ],
          }
        }
        return undefined
      })
      build.onLoad({ filter: /.*/, namespace: "hbd-shim" }, (args) => ({ contents: modules[args.path], loader: "js" }))
      build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        const source = await readFile(args.path, "utf8")
        for (const [re, name] of BANNED_SOURCE) {
          if (re.test(source)) {
            return { errors: [{ text: `${name} is not allowed in a plugin`, location: { file: args.path } }] }
          }
        }
        return { contents: source, loader: args.path.endsWith("x") ? "tsx" : "ts" }
      })
    },
  }
}

async function bundle(entry: string, kind: "server" | "view"): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: kind === "server" ? "node" : "browser",
    target: "es2022",
    jsx: "automatic",
    banner: { js: kind === "server" ? SERVER_BANNER : VIEW_BANNER },
    plugins: [shimPlugin(kind)],
    logLevel: "silent",
  })
  return result.outputFiles[0]?.text ?? ""
}

function formatError(err: unknown): string {
  const errors = (err as { errors?: esbuild.Message[] }).errors
  if (errors?.length) {
    return errors
      .map((e) => `${e.location ? `${path.basename(e.location.file)}:${e.location.line}: ` : ""}${e.text}`)
      .join("; ")
  }
  return err instanceof Error ? err.message : String(err)
}

/* ---------- compile ---------- */

async function sourceHash(dir: string): Promise<string> {
  const h = createHash("sha256")
  const walk = async (d: string) => {
    for (const entry of (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(p)
      else if (/\.(tsx?|jsx?|json)$/.test(entry.name)) h.update(p).update(await readFile(p))
    }
  }
  await walk(dir)
  return h.digest("hex").slice(0, 12)
}

async function compile(id: string): Promise<LocalPlugin> {
  const dir = path.join(PLUGINS_DIR, id)
  const hash = await sourceHash(dir)
  const previous = local.get(id)
  if (previous?.hash === hash) return previous
  const out = path.join(BUILD_DIR, id)
  try {
    if (builtinPlugins.has(id)) throw new Error(`"${id}" is a built-in widget type; rename the folder`)
    await mkdir(out, { recursive: true })
    const serverFile = path.join(out, `server.${hash}.mjs`)
    await writeFile(serverFile, await bundle(path.join(dir, "server.ts"), "server"))
    const mod = (await import(/* @vite-ignore */ pathToFileURL(serverFile).href)) as { default?: PluginDefinition }
    const plugin = mod.default
    if (!plugin || typeof plugin.load !== "function" || !(plugin.options instanceof z.ZodObject)) {
      throw new Error("server.ts must `export default definePlugin({ ... })` with options: z.object(...) and load")
    }
    if (plugin.id !== id) throw new Error(`definePlugin id "${plugin.id}" must match the folder name "${id}"`)

    const viewName = `view.${hash}.mjs`
    const viewFile = path.join(out, viewName)
    await writeFile(viewFile, await bundle(path.join(dir, "view.tsx"), "view"))
    const view = (await import(/* @vite-ignore */ pathToFileURL(viewFile).href)) as { default?: React.ComponentType }
    if (typeof view.default !== "function") throw new Error("view.tsx must export a default component")
    const viewUrl = `/plugins/${id}/${viewName}`
    registerLocalView(viewUrl, view.default as React.ComponentType<{ data: unknown }>)

    console.log(`[plugins] built ${id} (${hash})`)
    return { id, hash, plugin, viewUrl }
  } catch (err) {
    const error = formatError(err)
    console.warn(`[plugins] ${id}: ${error}${previous?.plugin ? " (keeping the last good build)" : ""}`)
    // Keep the last good build running, but surface the error.
    return { ...(previous ?? { id }), hash, error }
  }
}

async function scan(): Promise<boolean> {
  let ids: string[] = []
  try {
    const entries = await readdir(PLUGINS_DIR, { withFileTypes: true })
    ids = entries.filter((e) => e.isDirectory() && /^[a-z0-9][a-z0-9-]*$/.test(e.name)).map((e) => e.name)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
  let changed = false
  for (const id of [...local.keys()]) {
    if (!ids.includes(id)) {
      local.delete(id)
      changed = true
    }
  }
  for (const id of ids) {
    const before = local.get(id)
    const after = await compile(id)
    if (after !== before) {
      local.set(id, after)
      changed = true
    }
  }
  return changed
}

let stamp = ""
async function dirStamp(): Promise<string> {
  const parts: string[] = []
  const walk = async (d: string) => {
    for (const entry of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      if (entry.name.startsWith(".")) continue
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(p)
      else parts.push(`${p}:${(await stat(p).catch(() => undefined))?.mtimeMs}`)
    }
  }
  await walk(PLUGINS_DIR)
  return parts.sort().join("|")
}

/** Build every plugin once, then rebuild on change and call onChange. */
export async function startLocalPlugins(onChange: () => void): Promise<void> {
  stamp = await dirStamp()
  await scan()
  if (g.__harebearLocalStarted) return
  g.__harebearLocalStarted = true
  let timer: NodeJS.Timeout | undefined
  let running = Promise.resolve()
  const rebuild = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      running = running.then(async () => {
        stamp = await dirStamp()
        if (await scan()) onChange()
      })
    }, 200)
  }
  try {
    watch(PLUGINS_DIR, { recursive: true }, rebuild)
  } catch {
    // No plugins directory yet, or no file events: the poll below covers it.
  }
  setInterval(async () => {
    if ((await dirStamp()) !== stamp) rebuild()
  }, 3000).unref()
}
