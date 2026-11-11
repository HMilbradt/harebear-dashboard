import "@tanstack/react-start/server-only"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { dashboardSchema } from "./config"
import { getPlugin, pluginTypes } from "./registry"

type Json = Record<string, unknown>

const ENV_REF = { type: "string", pattern: "^env:[A-Za-z_][A-Za-z0-9_]*$", description: "env:NAME" }

/** Any leaf value may also be written as env:NAME. */
function allowEnv(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema
  const s = schema as Json
  if (s.type === "object" && s.properties) {
    return {
      ...s,
      properties: Object.fromEntries(Object.entries(s.properties as Json).map(([k, v]) => [k, allowEnv(v)])),
    }
  }
  if (s.type === "array" && s.items) return { ...s, items: allowEnv(s.items) }
  if (s.type === "string" || s.type === "number" || s.type === "integer") {
    return { anyOf: [s, ENV_REF], description: s.description }
  }
  return s
}

function toJson(schema: z.ZodType): Json {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Json
  return rest
}

export function widgetSchema(type: string): Json | undefined {
  const plugin = getPlugin(type)
  if (!plugin) return undefined
  const options = toJson(plugin.options)
  const secretKeys = Object.keys(plugin.secrets?.shape ?? {})
  return {
    type: "object",
    title: plugin.name,
    description: plugin.description,
    properties: {
      type: { const: type },
      id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$", description: "Stable id, unique on the page" },
      title: { type: "string" },
      titleUrl: { type: "string" },
      refresh: {
        type: "string",
        pattern: "^(never|\\d+(ms|s|m|h|d))$",
        description: `Default ${plugin.refresh ?? "5m"}`,
      },
      hideHeader: { type: "boolean" },
      ...(plugin.secrets
        ? {
            secrets: {
              type: "object",
              description: "Each value must be env:NAME",
              properties: Object.fromEntries(secretKeys.map((k) => [k, ENV_REF])),
              additionalProperties: secretKeys.length ? false : ENV_REF,
            },
          }
        : {}),
      ...((allowEnv(options) as Json).properties as Json),
    },
    required: ["id", "type", ...((options.required as string[]) ?? [])],
    additionalProperties: false,
  }
}

export function configSchemas(): { dashboard: Json; page: Json } {
  const widgets = pluginTypes().flatMap((t) => widgetSchema(t) ?? [])
  const node = {
    anyOf: [
      ...widgets,
      {
        type: "object",
        title: "group or split",
        properties: {
          type: { enum: ["group", "split"], description: "group: tabs; split: side by side" },
          id: { type: "string" },
          title: { type: "string" },
          widgets: { type: "array", items: { $ref: "#/$defs/node" } },
        },
        required: ["type", "widgets"],
        additionalProperties: false,
      },
    ],
  }
  const page = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "harebear-dashboard page",
    type: "object",
    properties: {
      title: { type: "string" },
      order: { type: "number", description: "Lower comes first; the first page is the home page" },
      width: { enum: ["slim", "default", "wide"] },
      center: { type: "boolean", description: "Center the page vertically" },
      columns: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            size: { enum: ["small", "full"] },
            widgets: { type: "array", items: { $ref: "#/$defs/node" } },
          },
          additionalProperties: false,
        },
      },
    },
    required: ["title", "columns"],
    additionalProperties: false,
    $defs: { node },
  }
  return {
    dashboard: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "harebear-dashboard",
      ...toJson(dashboardSchema),
    },
    page,
  }
}

/** Write CONFIG_DIR/.schema/{dashboard,page}.json. Returns false when the directory is read only. */
export async function writeSchemas(dir: string): Promise<boolean> {
  const { dashboard, page } = configSchemas()
  try {
    await mkdir(path.join(dir, ".schema"), { recursive: true })
    await writeFile(path.join(dir, ".schema", "dashboard.json"), `${JSON.stringify(dashboard, null, 2)}\n`)
    await writeFile(path.join(dir, ".schema", "page.json"), `${JSON.stringify(page, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}
