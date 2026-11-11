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
      {data.days.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {data.days.map((d) => {
            const span = Math.max(1, data.weekMax - data.weekMin)
            return (
              <div
                key={d.label}
                className="grid grid-cols-[2.75rem_1rem_2rem_1.75rem_1fr_1.75rem] items-center gap-2 py-1.5"
              >
                <Text size="sm" weight="medium">
                  {d.label}
                </Text>
                <WeatherIcon code={d.code} isDay size="sm" />
                <Text size="xs" tone={d.precip >= 50 ? "info" : "muted"} tabular>
                  {d.precip}%
                </Text>
                <Text size="sm" tone="muted" tabular>
                  {d.low}°
                </Text>
                <div className="relative h-1.5 rounded-full bg-muted">
                  <span
                    className="absolute inset-y-0 rounded-full bg-primary"
                    style={{
                      left: `${((d.low - data.weekMin) / span) * 100}%`,
                      right: `${((data.weekMax - d.high) / span) * 100}%`,
                    }}
                  />
                </div>
                <Text size="sm" tabular>
                  {d.high}°
                </Text>
              </div>
            )
          })}
        </div>
      )}
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
