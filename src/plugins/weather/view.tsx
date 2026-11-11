import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react"
import { Row, Stack, Text, type ViewProps } from "@/sdk"
import type plugin from "./server"

function WeatherIcon({ code, isDay, size }: { code: number; isDay: boolean; size: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-10 text-primary" : "size-4 text-muted-foreground"
  const Icon =
    code === 0
      ? isDay
        ? Sun
        : Moon
      : code <= 2
        ? isDay
          ? CloudSun
          : CloudMoon
        : code === 3
          ? Cloud
          : code <= 48
            ? CloudFog
            : code <= 57
              ? CloudDrizzle
              : code <= 67 || (code >= 80 && code <= 82)
                ? CloudRain
                : code <= 86
                  ? CloudSnow
                  : CloudLightning
  return <Icon aria-hidden className={cls} />
}

export default function WeatherView({ data }: ViewProps<typeof plugin>) {
  return (
    <Stack gap="lg">
      <Row gap="md" justify="between" align="center">
        <Stack gap="none">
          <Text size="2xl" weight="semibold" tabular>
            {data.temp}
            {data.unit}
          </Text>
          <Text tone="muted" size="sm">
            {data.description}, feels like {data.feelsLike}°
          </Text>
        </Stack>
        <WeatherIcon code={data.code} isDay={data.isDay} size="lg" />
      </Row>
      <div className="grid grid-cols-6 gap-1 text-center">
        {data.hours
          .filter((_, i) => i % 2 === 0)
          .map((h) => (
            <div key={h.label} className="flex flex-col items-center gap-1">
              <Text size="xs" tone="muted" tabular>
                {h.label}
              </Text>
              <WeatherIcon code={h.code} isDay={h.isDay} size="sm" />
              <Text size="sm" weight="medium" tabular>
                {h.temp}°
              </Text>
              <Text size="xs" tone={h.precip >= 50 ? "info" : "muted"} tabular>
                {h.precip}%
              </Text>
            </div>
          ))}
      </div>
      <Row justify="between">
        <Text size="sm" tone="muted" truncate>
          {data.place}
        </Text>
        <Text size="sm" tone="muted" tabular>
          H {data.high}° · L {data.low}°
        </Text>
      </Row>
    </Stack>
  )
}
