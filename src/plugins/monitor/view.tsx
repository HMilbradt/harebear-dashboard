import { Grid, IconImage, LinkTile, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function MonitorView({ data }: ViewProps<typeof plugin>) {
  return (
    <Grid cols={{ base: 2, sm: 3, md: 4 }} gap="sm">
      {data.map((s) => (
        <LinkTile
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.title}
          icon={<IconImage icon={s.icon} fallback={s.title} />}
          status={
            s.up
              ? { tone: "success", label: `${s.latencyMs} ms` }
              : { tone: "danger", label: s.code ? `HTTP ${s.code}` : "Down" }
          }
          subtitle={s.error ? s.error : undefined}
        />
      ))}
    </Grid>
  )
}
