import "@tanstack/react-start/server-only"
import type { PluginDefinition } from "@/sdk/plugin"
import bookmarks from "./bookmarks/server"
import calendar from "./calendar/server"
import clock from "./clock/server"
import docker from "./docker/server"
import http from "./http/server"
import monitor from "./monitor/server"
import rss from "./rss/server"
import search from "./search/server"
import seerr from "./seerr/server"
import serverStats from "./server-stats/server"
import speedtest from "./speedtest-tracker/server"
import weather from "./weather/server"

/** Built-in plugins, by type. Server only: loaders, schemas and hosts never reach the browser. */
export const builtinPlugins = new Map<string, PluginDefinition>(
  [search, clock, calendar, bookmarks, monitor, weather, rss, speedtest, seerr, serverStats, docker, http].map((p) => [
    p.id,
    p as unknown as PluginDefinition,
  ]),
)
