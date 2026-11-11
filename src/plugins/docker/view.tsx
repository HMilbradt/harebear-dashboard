import { IconImage, Link, List, Row, Stack, StatusDot, Text, type ViewProps } from "@/sdk"
import type plugin from "./server"

const tone = (state: string) =>
  state === "running" ? "success" : state === "restarting" || state === "paused" ? "warning" : "danger"

export default function DockerView({ data }: ViewProps<typeof plugin>) {
  const running = data.filter((c) => c.state === "running").length
  return (
    <Stack gap="md">
      <Text size="sm" tone="muted">
        {running} of {data.length} running
      </Text>
      <List divided>
        {data.map((c) => (
          <Row key={c.id} gap="md" justify="between">
            <Row gap="sm">
              <IconImage icon={c.icon} fallback={c.name} size="sm" />
              <Stack gap="none">
                <Text weight="medium" truncate>
                  {c.url ? <Link href={c.url}>{c.name}</Link> : c.name}
                </Text>
                <Text size="xs" tone="muted" mono truncate title={c.image}>
                  {c.description ?? c.image}
                </Text>
              </Stack>
            </Row>
            <Row gap="xs">
              <Text size="xs" tone="muted" truncate>
                {c.status}
              </Text>
              <StatusDot tone={tone(c.state)} />
            </Row>
          </Row>
        ))}
      </List>
    </Stack>
  )
}
