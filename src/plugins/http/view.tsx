import { KeyValueGrid, Link, LinkTile, Grid, Metric, MetricGroup, ShowMore, Stack, Text, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function HttpView({ data }: ViewProps<typeof plugin>) {
  switch (data.kind) {
    case "stats":
      return (
        <MetricGroup>
          {data.items.map((i) => (
            <Metric key={i.label} label={i.label} value={i.value} unit={i.unit} />
          ))}
        </MetricGroup>
      )
    case "key-value":
      return (
        <KeyValueGrid
          columns={2}
          items={data.items.map((i) => ({ label: i.label, value: i.unit ? `${i.value} ${i.unit}` : i.value }))}
        />
      )
    case "table":
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                {data.columns.map((c) => (
                  <th key={c} className="px-1 pb-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className="px-1 py-1.5">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "links":
      return (
        <Grid cols={{ base: 1, sm: 2, md: 3 }} gap="sm">
          {data.rows.map((r, i) => (
            <LinkTile key={i} href={r.url} target="_blank" rel="noreferrer" title={r.title} subtitle={r.subtitle} />
          ))}
        </Grid>
      )
    default:
      return (
        <ShowMore initial={data.collapseAfter}>
          {data.rows.map((r, i) => (
            <Stack key={i} gap="none">
              <Text weight="medium" lines={2}>
                {r.url ? <Link href={r.url}>{r.title}</Link> : r.title}
              </Text>
              {r.subtitle && (
                <Text size="xs" tone="muted">
                  {r.subtitle}
                </Text>
              )}
            </Stack>
          ))}
        </ShowMore>
      )
  }
}
