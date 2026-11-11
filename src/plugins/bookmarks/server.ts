import { z } from "zod"
import { definePlugin } from "@/sdk/plugin"
import { iconHosts, iconOption, resolveIcon } from "../_shared/icons"

const link = z
  .object({
    title: z.string(),
    url: z.url(),
    icon: iconOption.optional(),
    description: z.string().optional(),
    newTab: z.boolean().optional(),
  })
  .strict()

export default definePlugin({
  id: "bookmarks",
  name: "Bookmarks",
  description: "Groups of links, optionally with icons.",
  options: z.object({
    groups: z.array(z.object({ title: z.string().optional(), links: z.array(link).min(1) }).strict()).min(1),
    newTab: z.boolean().default(false),
  }),
  imageHosts: (o) => iconHosts(o.groups.flatMap((g) => g.links.map((l) => l.icon))),
  refresh: "never",
  load: ({ options }) =>
    options.groups.map((g) => ({
      title: g.title,
      links: g.links.map((l) => ({
        title: l.title,
        url: l.url,
        description: l.description,
        icon: resolveIcon(l.icon),
        newTab: l.newTab ?? options.newTab,
      })),
    })),
})
