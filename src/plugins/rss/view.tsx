import { Link, ShowMore, Stack, Text, type ViewProps } from "@/sdk"
import { ago } from "../_shared/time"
import type plugin from "./server"

export default function RssView({ data }: ViewProps<typeof plugin>) {
  return (
    <Stack gap="md">
      <ShowMore initial={data.collapseAfter}>
        {data.items.map((item) => (
          <Stack key={item.url + item.title} gap="none">
            <Text weight="medium" lines={2}>
              <Link href={item.url}>{item.title}</Link>
            </Text>
            <Text size="xs" tone="muted">
              {item.source}
              {item.publishedAt ? ` · ${ago(item.publishedAt, data.now)}` : ""}
            </Text>
          </Stack>
        ))}
      </ShowMore>
      {data.failed.length > 0 && (
        <Text size="xs" tone="warning">
          Could not load {data.failed.join("; ")}
        </Text>
      )}
    </Stack>
  )
}
