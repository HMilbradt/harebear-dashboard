import * as React from "react"
import { Row, Stack, Text, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function ClockView({ data }: ViewProps<typeof plugin>) {
  const [now, setNow] = React.useState<Date>()
  React.useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const time = (tz?: string) =>
    now?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: data.hour12, timeZone: tz }) ??
    "--:--"
  return (
    <Stack gap="sm">
      <Text size="2xl" weight="semibold" tabular>
        {time(data.timezone)}
      </Text>
      <Text tone="muted">
        {now?.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: data.timezone,
        }) ?? " "}
      </Text>
      {data.zones.map((z) => (
        <Row key={z.timezone} justify="between">
          <Text tone="muted">{z.label ?? z.timezone.split("/").pop()?.replace(/_/g, " ")}</Text>
          <Text tabular weight="medium">
            {time(z.timezone)}
          </Text>
        </Row>
      ))}
    </Stack>
  )
}
