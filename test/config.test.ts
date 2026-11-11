import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadConfig } from "@/server/config"

async function configDir(pages: Record<string, string>, dashboard?: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "hbd-"))
  await mkdir(path.join(dir, "pages"))
  if (dashboard) await writeFile(path.join(dir, "dashboard.yaml"), dashboard)
  for (const [name, body] of Object.entries(pages)) await writeFile(path.join(dir, "pages", name), body)
  return dir
}

const page = (widgets: string) => `title: Test
columns:
  - size: full
    widgets:
${widgets}`

afterEach(() => {
  delete process.env.HBD_TEST_TOKEN
  delete process.env.HBD_TEST_URL
})

describe("loadConfig", () => {
  it("loads the shipped example config without errors", async () => {
    const { config, errors } = await loadConfig(path.resolve("examples/config"))
    expect(errors).toEqual([])
    expect(config?.pages.map((p) => p.slug)).toEqual(["home", "homelab"])
  })

  it("reports an unknown key with its file and line", async () => {
    const dir = await configDir({
      "a.yaml": page(`      - id: c
        type: clock
        colour: red`),
    })
    const { config, errors } = await loadConfig(dir)
    expect(config).toBeUndefined()
    expect(errors).toEqual([
      { file: "pages/a.yaml", line: 7, path: "columns[0].widgets[0]", message: "Unknown key: colour" },
    ])
  })

  it("rejects a literal secret", async () => {
    const dir = await configDir({
      "a.yaml": page(`      - id: s
        type: speedtest-tracker
        url: https://speedtest.example.com
        secrets:
          token: abc123`),
    })
    const { errors } = await loadConfig(dir)
    expect(errors[0]?.path).toBe("columns[0].widgets[0].secrets.token")
    expect(errors[0]?.message).toMatch(/env:NAME/)
  })

  it("requires declared secrets", async () => {
    const dir = await configDir({
      "a.yaml": page(`      - id: s
        type: speedtest-tracker
        url: https://speedtest.example.com`),
    })
    const { errors } = await loadConfig(dir)
    expect(errors[0]?.message).toBe('"speedtest-tracker" needs secrets.token: env:NAME')
  })

  it("resolves env refs in options and errors when one is unset", async () => {
    const body = page(`      - id: s
        type: speedtest-tracker
        url: env:HBD_TEST_URL
        secrets:
          token: env:HBD_TEST_TOKEN`)
    const dir = await configDir({ "a.yaml": body })
    const missing = await loadConfig(dir)
    expect(missing.errors[0]?.message).toMatch(/HBD_TEST_URL is not set/)

    process.env.HBD_TEST_URL = "https://speedtest.example.com"
    const ok = await loadConfig(dir)
    expect(ok.errors).toEqual([])
    const w = ok.config?.pages[0]?.widgets.get("s")
    expect(w?.options.url).toBe("https://speedtest.example.com")
    // Secrets stay as references until a load runs.
    expect(w?.secretRefs).toEqual({ token: "env:HBD_TEST_TOKEN" })
  })

  it("rejects duplicate widget ids and unknown types", async () => {
    const dir = await configDir({
      "a.yaml": page(`      - id: x
        type: clock
      - id: x
        type: clock
      - id: y
        type: nope`),
    })
    const { errors } = await loadConfig(dir)
    expect(errors.map((e) => e.message)).toEqual([
      'Duplicate widget id "x" on this page',
      expect.stringMatching(/^Unknown widget type "nope"/),
    ])
  })

  it("parses groups and splits", async () => {
    const dir = await configDir({
      "a.yaml": page(`      - type: group
        widgets:
          - id: a
            type: clock
          - id: b
            type: calendar`),
    })
    const { config, errors } = await loadConfig(dir)
    expect(errors).toEqual([])
    expect(config?.pages[0]?.columns[0]?.nodes[0]).toEqual({
      kind: "group",
      title: undefined,
      children: [
        { kind: "widget", id: "a" },
        { kind: "widget", id: "b" },
      ],
    })
  })
})
