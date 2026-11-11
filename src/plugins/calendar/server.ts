import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"

export default definePlugin({
  id: "calendar",
  name: "Calendar",
  description: "This month at a glance, today highlighted.",
  options: z.object({
    firstDay: z.enum(["monday", "sunday"]).default("monday"),
  }),
  refresh: "never",
  load: ({ options }) => options,
})
