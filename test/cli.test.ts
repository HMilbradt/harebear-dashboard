/** The bundled CLI. Run after `pnpm build`. */
import { execFile } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const run = promisify(execFile)
const cli = (args: string[], env: Record<string, string> = {}) =>
  run(process.execPath, ["dist/cli.mjs", ...args], {
    env: { ...process.env, PLUGINS_DIR: "examples/plugins", ...env },
  }).then(
    (r) => ({ code: 0, out: r.stdout }),
    (e: { code: number; stdout: string }) => ({ code: e.code, out: e.stdout }),
  )

describe("cli", () => {
  it("validates the example config", async () => {
    const r = await cli(["validate", "examples/config"])
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/OK: 2 page\(s\)/)
  })

  it("init writes a config that validates, with schemas for every widget type", async () => {
    const dir = path.join(await mkdtemp(path.join(tmpdir(), "hbd-cli-")), "config")
    expect((await cli(["init", dir])).code).toBe(0)
    const page = JSON.parse(await readFile(path.join(dir, ".schema", "page.json"), "utf8"))
    const types = page.$defs.node.anyOf.map(
      (w: { properties: { type: { const?: string } } }) => w.properties.type.const,
    )
    expect(types).toEqual(expect.arrayContaining(["search", "weather", "http", "github-repo"]))
    await writeFile(
      path.join(dir, "pages", "bad.yaml"),
      "title: X\ncolumns:\n  - widgets:\n      - id: a\n        type: nope\n",
    )
    const bad = await cli(["validate", dir])
    expect(bad.code).toBe(1)
    expect(bad.out).toMatch(/^pages\/bad\.yaml:5 columns\[0\]\.widgets\[0\]\.type Unknown widget type "nope"/m)
  })

  it("documents a widget's options", async () => {
    const r = await cli(["docs", "weather"])
    expect(r.out).toContain('- units: "metric" | "imperial" (default "metric")')
  })

  it("hashes a password from stdin", async () => {
    const child = execFile(process.execPath, ["dist/cli.mjs", "hash-password"])
    child.stdin?.end("correct horse battery\n")
    const out = await new Promise<string>((resolve) => {
      let s = ""
      child.stdout?.on("data", (d) => {
        s += d
      })
      child.on("close", () => resolve(s))
    })
    expect(out.trim()).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  })
})
