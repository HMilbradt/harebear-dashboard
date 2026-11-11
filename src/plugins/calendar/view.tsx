import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import type { ViewProps } from "@/sdk"
import type plugin from "./server"

// Built-in view: trusted, so it may use classes directly.
export default function CalendarView({ data }: ViewProps<typeof plugin>) {
  const [today, setToday] = React.useState<Date>()
  const [offset, setOffset] = React.useState(0)
  React.useEffect(() => setToday(new Date()), [])
  if (!today) return <div className="h-64" />

  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const start = data.firstDay === "monday" ? 1 : 0
  const lead = (month.getDay() - start + 7) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const names = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + start + i).toLocaleDateString(undefined, { weekday: "narrow" }),
  )
  const isToday = (d: number) => offset === 0 && d === today.getDate()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setOffset(offset - 1)}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setOffset(offset + 1)}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[13px] tabular-nums">
        {names.map((n, i) => (
          <span key={i} className="pb-1 text-xs font-medium text-muted-foreground">
            {n}
          </span>
        ))}
        {cells.map((d, i) => (
          <span
            key={i}
            className={
              d && isToday(d)
                ? "mx-auto grid size-8 place-items-center rounded-full bg-primary font-semibold text-primary-foreground"
                : "mx-auto grid size-8 place-items-center"
            }
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}
