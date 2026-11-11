import { MediaItem, ShowMore, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function SeerrView({ data }: ViewProps<typeof plugin>) {
  return (
    <ShowMore initial={data.collapseAfter}>
      {data.items.map((m) => (
        <MediaItem
          key={m.href}
          title={m.title}
          href={m.href}
          image={m.poster}
          meta={[m.type, m.year, m.rating ? `TMDB ${m.rating}%` : undefined].filter(Boolean).join(" · ")}
          description={m.overview}
        />
      ))}
    </ShowMore>
  )
}
