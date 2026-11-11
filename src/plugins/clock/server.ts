import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"

export default definePlugin({
  id: "clock",
  name: "Clock",
  description: "Current time and date, with optional extra time zones.",
  options: z.object({
    hour12: z.boolean().default(false),
    timezone: z.string().optional().describe("IANA zone, e.g. America/Vancouver. Default: the browser's."),
    zones: z
      .array(z.object({ timezone: z.string(), label: z.string().optional() }).strict())
      .default([])
      .describe("Extra clocks shown below"),
  }),
  refresh: "never",
  load: ({ options }) => options,
})
