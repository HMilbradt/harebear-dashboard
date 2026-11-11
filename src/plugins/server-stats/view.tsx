import { KeyValueGrid, Stack, Text, UsageMeter, type ViewProps } from "@/sdk"
import type plugin from "./server"

const gb = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : `${(b / 1e9).toFixed(1)} GB`)
const color = (p: number) => (p >= 90 ? "var(--destructive)" : p >= 75 ? "var(--warning)" : undefined)
function uptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`
}

export default function ServerStatsView({ data }: ViewProps<typeof plugin>) {
  const memPct = data.mem.total ? Math.round((data.mem.used / data.mem.total) * 100) : 0
  return (
    <Stack gap="lg">
      <Text weight="semibold">{data.name}</Text>
      <UsageMeter
        label="CPU"
        percent={data.cpu}
        value={`${data.cpu}%`}
        detail={`${data.cores} cores`}
        color={color(data.cpu)}
      />
      <UsageMeter
        label="Memory"
        percent={memPct}
        value={gb(data.mem.used)}
        detail={`of ${gb(data.mem.total)}`}
        color={color(memPct)}
      />
      {data.disks.map((d) => {
        const p = d.total ? Math.round((d.used / d.total) * 100) : 0
        return d.error ? (
          <Text key={d.label} size="sm" tone="warning">
            {d.label}: {d.error}
          </Text>
        ) : (
          <UsageMeter
            key={d.label}
            label={d.label}
            percent={p}
            value={gb(d.used)}
            detail={`of ${gb(d.total)}`}
            color={color(p)}
          />
        )
      })}
      <KeyValueGrid
        columns={data.temp !== undefined ? 3 : 2}
        items={[
          { label: "Load", value: data.load.join(" ") },
          { label: "Uptime", value: uptime(data.uptime) },
          ...(data.temp !== undefined ? [{ label: "Temp", value: `${data.temp}°C` }] : []),
        ]}
      />
    </Stack>
  )
}
