import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

const dir = await mkdtemp(path.join(tmpdir(), "hbd-plugins-"))
process.env.PLUGINS_DIR = dir
const lp = await import("@/server/local-plugins")

const view = `import { Text } from "harebear-dashboard/sdk"
export default function View({ data }) { return <Text>{data.n}</Text> }`

async function plugin(id: string, server: string, viewSource = view) {
  await mkdir(path.join(dir, id), { recursive: true })
  await writeFile(path.join(dir, id, "server.ts"), server)
  await writeFile(path.join(dir, id, "view.tsx"), viewSource)
}

const ok = (
  id: string,
  body = "return { n: ctx.options.n * 2 }",
) => `import { definePlugin, z } from "harebear-dashboard/sdk"
export default definePlugin({
  id: "${id}", name: "T", description: "t",
  options: z.object({ n: z.number() }),
  load(ctx) { ${body} },
})`

const ctx = (options: unknown) =>
  ({
    options,
    secrets: {},
    fetch: async () => ({}),
    widget: { page: "p", id: "w" },
    signal: new AbortController().signal,
  }) as never

beforeAll(async () => {
  await plugin("good", ok("good"))
  await plugin(
    "uses-fs",
    `import { readFileSync } from "node:fs"\n${ok("uses-fs", "return readFileSync('/etc/passwd', 'utf8')")}`,
  )
  await plugin("bare-fetch", ok("bare-fetch", "return fetch('https://example.com')"))
  await plugin("wrong-id", ok("other"))
  await plugin("leaky-view", ok("leaky-view"), `export default () => <div dangerouslySetInnerHTML={{ __html: "x" }} />`)
  await lp.startLocalPlugins(() => {})
})

describe("local plugins", () => {
  it("builds a plugin whose load and view work", async () => {
    const p = lp.localPlugin("good")
    expect(p?.error).toBeUndefined()
    expect(await p?.plugin?.load(ctx({ n: 21 }))).toEqual({ n: 42 })
    expect(p?.viewUrl).toMatch(/^\/plugins\/good\/view\.[0-9a-f]{12}\.mjs$/)
  })

  it("refuses node built-ins", () => {
    expect(lp.localPlugin("uses-fs")?.error).toMatch(/"node:fs" is not allowed/)
  })

  it("shadows the global fetch so only ctx.fetch reaches the network", async () => {
    await expect(async () => lp.localPlugin("bare-fetch")?.plugin?.load(ctx({ n: 1 }))).rejects.toThrow(TypeError)
  })

  it("requires the id to match the folder", () => {
    expect(lp.localPlugin("wrong-id")?.error).toMatch(/must match the folder name/)
  })

  it("refuses dangerouslySetInnerHTML in views", () => {
    expect(lp.localPlugin("leaky-view")?.error).toMatch(/dangerouslySetInnerHTML is not allowed/)
  })

  it("keeps the last good build when an edit breaks it", async () => {
    const before = lp.localPlugin("good")
    await writeFile(path.join(dir, "good", "server.ts"), "this is not typescript (")
    const changed = new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (lp.localPlugin("good")?.error) {
          clearInterval(t)
          resolve()
        }
      }, 100)
    })
    await changed
    const after = lp.localPlugin("good")
    expect(after?.error).toBeTruthy()
    expect(after?.plugin).toBe(before?.plugin)
    expect(after?.viewUrl).toBe(before?.viewUrl)
  })
})
