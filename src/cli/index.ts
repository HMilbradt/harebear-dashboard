#!/usr/bin/env node
/*
 * harebear-dashboard CLI. Agent friendly: every command prints plain text or
 * JSON and exits non-zero on failure.
 */
import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"

const HELP = `harebear-dashboard <command>

  init [dir]                 Copy the example config into dir (default ./config)
  validate [dir]             Check a config directory; errors print as file:line path message
  schema [dir]               Write dir/.schema/{dashboard,page}.json for editor completion
  docs [type]                List widget types, or one type's options
  data <page>/<widget>       Run one widget's load and print the JSON its view receives
  new-plugin <id> [dir]      Scaffold a local plugin in dir (default $PLUGINS_DIR or ./plugins)
  hash-password              Read a password and print the hash for auth.passwordHash

  CONFIG_DIR and PLUGINS_DIR are read from the environment, like the server.`

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function exists(p: string) {
  return stat(p).then(
    () => true,
    () => false,
  )
}

function configDir(arg?: string) {
  return path.resolve(arg ?? process.env.CONFIG_DIR ?? "config")
}

async function loadAll(dir: string) {
  process.env.CONFIG_DIR = dir
  const { startLocalPlugins } = await import("../server/local-plugins")
  await startLocalPlugins(() => {})
  const { loadConfig } = await import("../server/config")
  return loadConfig(dir)
}

async function cmdInit(arg?: string) {
  const dir = configDir(arg)
  if ((await exists(dir)) && (await readdir(dir)).length) throw new Error(`${dir} is not empty`)
  await cp(path.join(root, "examples", "config"), dir, { recursive: true })
  await loadAll(dir)
  const { writeSchemas } = await import("../server/schema")
  await writeSchemas(dir)
  console.log(`Wrote ${dir}. Edit pages/*.yaml; a running dashboard picks up every save.`)
}

async function cmdValidate(arg?: string) {
  const dir = configDir(arg)
  const { config, errors } = await loadAll(dir)
  if (errors.length) {
    for (const e of errors)
      console.log(`${e.file}${e.line ? `:${e.line}` : ""} ${e.path} ${e.message}`.replace(/\s+/g, " "))
    process.exitCode = 1
    return
  }
  const widgets = config?.pages.reduce((n, p) => n + p.widgets.size, 0) ?? 0
  console.log(`OK: ${config?.pages.length ?? 0} page(s), ${widgets} widget(s)`)
}

async function cmdSchema(arg?: string) {
  const dir = configDir(arg)
  await loadAll(dir)
  const { writeSchemas } = await import("../server/schema")
  if (!(await writeSchemas(dir))) throw new Error(`Cannot write ${path.join(dir, ".schema")}`)
  console.log(`Wrote ${path.join(dir, ".schema", "dashboard.json")} and page.json`)
}

async function cmdDocs(type?: string) {
  await loadAll(configDir())
  const { getPlugin, pluginTypes } = await import("../server/registry")
  const { widgetSchema } = await import("../server/schema")
  if (!type) {
    for (const t of pluginTypes()) console.log(`${t.padEnd(20)} ${getPlugin(t)?.description ?? ""}`)
    console.log("\nharebear-dashboard docs <type> for options.")
    return
  }
  const plugin = getPlugin(type)
  const schema = widgetSchema(type)
  if (!plugin || !schema) throw new Error(`Unknown widget type ${type}`)
  console.log(`# ${type}\n\n${plugin.description}\n\nDefault refresh: ${plugin.refresh ?? "5m"}\n`)
  type Prop = { description?: string; default?: unknown; type?: unknown; enum?: unknown[]; anyOf?: Prop[] }
  const props = schema.properties as Record<string, Prop>
  const required = new Set(schema.required as string[])
  for (const [k, outer] of Object.entries(props)) {
    if (["type", "id", "title", "titleUrl", "refresh", "hideHeader"].includes(k)) continue
    const v = { ...outer.anyOf?.[0], ...outer }
    const t = v.enum ? v.enum.map((e) => JSON.stringify(e)).join(" | ") : (v.type ?? "object")
    const def = v.default === undefined ? "" : ` (default ${JSON.stringify(v.default)})`
    console.log(`- ${k}${required.has(k) ? " (required)" : ""}: ${t}${def}${v.description ? `. ${v.description}` : ""}`)
  }
  console.log("\nEvery widget also takes id, title, titleUrl, refresh and hideHeader.")
}

async function cmdData(target?: string) {
  const [page, id] = target?.split("/") ?? []
  if (!page || !id) throw new Error("Usage: harebear-dashboard data <page>/<widget>")
  const { config, errors } = await loadAll(configDir())
  if (!config)
    throw new Error(`Config has errors:\n${errors.map((e) => `  ${e.file}:${e.line ?? ""} ${e.message}`).join("\n")}`)
  const w = config.pages.find((p) => p.slug === page)?.widgets.get(id)
  if (!w) throw new Error(`No widget ${id} on page ${page}`)
  const { widgetData } = await import("../server/runner")
  const result = await widgetData(w)
  console.log(JSON.stringify(result, null, 2))
  if (result.status === "error") process.exitCode = 1
}

async function cmdNewPlugin(id?: string, dirArg?: string) {
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id))
    throw new Error("Usage: harebear-dashboard new-plugin <id> (lowercase, digits, dashes)")
  const dir = path.join(path.resolve(dirArg ?? process.env.PLUGINS_DIR ?? "plugins"), id)
  if (await exists(dir)) throw new Error(`${dir} already exists`)
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, "server.ts"),
    `import { definePlugin, hostOf, z } from "harebear-dashboard/sdk"

export default definePlugin({
  id: "${id}",
  name: "${id}",
  description: "What this widget shows, in one sentence.",
  options: z.object({
    url: z.url().describe("Where the data comes from"),
  }),
  // secrets: z.object({ token: z.string() }),   // config: secrets: { token: env:NAME }
  hosts: (o) => hostOf(o.url), // ctx.fetch refuses every other host
  refresh: "5m",
  async load({ options, fetch }) {
    const res = await fetch(options.url, { headers: { accept: "application/json" } })
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`)
    const json = await res.json<Record<string, unknown>>()
    return { count: Object.keys(json).length }
  },
})
`,
  )
  await writeFile(
    path.join(dir, "view.tsx"),
    `import { Metric, MetricGroup, type ViewProps } from "harebear-dashboard/sdk"
import type plugin from "./server"

export default function View({ data }: ViewProps<typeof plugin>) {
  return (
    <MetricGroup>
      <Metric label="Keys" value={data.count} />
    </MetricGroup>
  )
}
`,
  )
  await writeFile(path.join(dir, "fixture.json"), `${JSON.stringify({ count: 3 }, null, 2)}\n`)
  console.log(`Wrote ${dir}. Use it with:\n\n  - id: ${id}\n    type: ${id}\n    url: https://example.com/api.json`)
}

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const c of process.stdin) chunks.push(c as Buffer)
    return Buffer.concat(chunks).toString("utf8").split("\n")[0] ?? ""
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  out._writeToOutput = (s: string) => {
    if (s.includes(prompt)) out.output.write(s)
  }
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve))
  rl.close()
  process.stdout.write("\n")
  return answer
}

async function cmdHashPassword() {
  const a = await readSecret("Password: ")
  if (a.length < 8) throw new Error("Use at least 8 characters")
  if (process.stdin.isTTY && (await readSecret("Again: ")) !== a) throw new Error("The passwords do not match")
  const { hashPassword } = await import("../server/auth")
  console.log(await hashPassword(a))
}

const [cmd, ...args] = process.argv.slice(2)
const commands: Record<string, (...a: string[]) => Promise<void>> = {
  init: cmdInit,
  validate: cmdValidate,
  schema: cmdSchema,
  docs: cmdDocs,
  data: cmdData,
  "new-plugin": cmdNewPlugin,
  "hash-password": cmdHashPassword,
}

const run = cmd ? commands[cmd] : undefined
if (!run) {
  console.log(HELP)
  process.exitCode = cmd && cmd !== "help" && cmd !== "--help" ? 1 : 0
} else {
  run(...args)
    .catch((err: Error) => {
      console.error(`error: ${err.message}`)
      process.exitCode = 1
    })
    .finally(() => setTimeout(() => process.exit(), 50).unref())
}
