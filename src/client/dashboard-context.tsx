import * as React from "react"
import type { ShellData } from "@/server/fns"

const Ctx = React.createContext<ShellData | null>(null)

export const DashboardProvider = Ctx.Provider

export function useDashboard(): ShellData {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useDashboard outside DashboardProvider")
  return v
}
