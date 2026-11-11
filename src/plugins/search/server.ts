import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"

export default definePlugin({
  id: "search",
  name: "Search",
  description: "Search box with a configurable engine and bang shortcuts (e.g. !yt cats). Focus it with /.",
  options: z.object({
    engine: z.string().optional().describe("Overrides dashboard.yaml search.engine"),
    placeholder: z.string().default("Search the web"),
    autofocus: z.boolean().default(true),
    newTab: z.boolean().default(false),
  }),
  refresh: "never",
  load: ({ options }) => options,
})
