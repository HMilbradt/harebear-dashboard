import { Metric, MetricGroup, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function SpeedtestView({ data }: ViewProps<typeof plugin>) {
  return (
    <MetricGroup>
      <Metric label="Download" value={data.down} unit="Mbps" delta={data.downDiff ?? undefined} />
      <Metric label="Upload" value={data.up} unit="Mbps" delta={data.upDiff ?? undefined} />
      <Metric label="Ping" value={data.ping} unit="ms" delta={data.pingDiff ?? undefined} lowerIsBetter />
    </MetricGroup>
  )
}
