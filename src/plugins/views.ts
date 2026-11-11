import type { ComponentType } from "react"
import bookmarks from "./bookmarks/view"
import calendar from "./calendar/view"
import clock from "./clock/view"
import docker from "./docker/view"
import http from "./http/view"
import monitor from "./monitor/view"
import rss from "./rss/view"
import search from "./search/view"
import seerr from "./seerr/view"
import serverStats from "./server-stats/view"
import speedtest from "./speedtest-tracker/view"
import weather from "./weather/view"

// biome-ignore lint/suspicious/noExplicitAny: each view types its own data
export const views: Record<string, ComponentType<{ data: any }>> = {
  bookmarks,
  calendar,
  clock,
  docker,
  http,
  monitor,
  rss,
  search,
  seerr,
  "server-stats": serverStats,
  "speedtest-tracker": speedtest,
  weather,
}

/** Widgets whose view is the whole card (no chrome padding, no title by default). */
export const bare = new Set(["search"])
