import { Link, Metric, MetricGroup, Stack, Text, type ViewProps } from "harebear-dashboard/sdk"
import type plugin from "./server"

export default function View({ data }: ViewProps<typeof plugin>) {
  return (
    <Stack gap="md">
      <Stack gap="none">
        <Text weight="semibold">
          <Link href={data.url}>{data.name}</Link>
        </Text>
        {data.description && (
          <Text size="sm" tone="muted" lines={2}>
            {data.description}
          </Text>
        )}
      </Stack>
      <MetricGroup>
        <Metric label="Stargazers" value={data.stars} />
        <Metric label="Forks" value={data.forks} />
        <Metric label="Issues" value={data.issues} />
      </MetricGroup>
    </Stack>
  )
}
