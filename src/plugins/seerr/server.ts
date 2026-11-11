import { z } from "zod"
import { definePlugin, hostOf } from "@/sdk/plugin"

interface Result {
  id: number
  mediaType: "movie" | "tv" | "person"
  title?: string
  name?: string
  posterPath?: string | null
  releaseDate?: string
  firstAirDate?: string
  voteAverage?: number
  overview?: string
}

export default definePlugin({
  id: "seerr",
  name: "Trending",
  description:
    "Trending, popular movies or popular TV from Seerr (or Overseerr/Jellyseerr), linking to the request page.",
  options: z.object({
    url: z.url().describe("Seerr URL the server can reach"),
    publicUrl: z.url().optional().describe("Seerr URL for links in the browser, if different"),
    list: z.enum(["trending", "movies", "tv"]).default("trending"),
    limit: z.number().int().min(1).max(40).default(10),
    collapseAfter: z.number().int().min(1).default(5),
    showOverview: z.boolean().default(true),
  }),
  secrets: z.object({ apiKey: z.string().describe("Seerr API key (Settings, General)") }),
  hosts: (o) => hostOf(o.url),
  imageHosts: () => ["https://image.tmdb.org"],
  refresh: "15m",
  async load({ options, secrets, fetch }) {
    const base = options.url.replace(/\/$/, "")
    const link = (options.publicUrl ?? options.url).replace(/\/$/, "")
    const res = await fetch(`${base}/api/v1/discover/${options.list}?page=1&language=en`, {
      headers: { "x-api-key": secrets.apiKey, accept: "application/json" },
    })
    if (!res.ok) throw new Error(`Seerr returned HTTP ${res.status}`)
    const { results = [] } = await res.json<{ results?: Result[] }>()
    return {
      collapseAfter: options.collapseAfter,
      items: results
        .filter((r) => r.mediaType === "movie" || r.mediaType === "tv")
        .slice(0, options.limit)
        .map((r) => ({
          title: (r.mediaType === "movie" ? r.title : r.name) ?? "Untitled",
          type: r.mediaType === "movie" ? "Movie" : "TV",
          year: (r.releaseDate ?? r.firstAirDate ?? "").slice(0, 4),
          rating: r.voteAverage ? Math.round(r.voteAverage * 10) : undefined,
          overview: options.showOverview ? r.overview : undefined,
          poster: r.posterPath ? `https://image.tmdb.org/t/p/w185${r.posterPath}` : undefined,
          href: `${link}/${r.mediaType}/${r.id}`,
        })),
    }
  },
})
