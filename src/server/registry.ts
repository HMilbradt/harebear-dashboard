import "@tanstack/react-start/server-only"
import { builtinPlugins } from "@/plugins/server"
import type { PluginDefinition } from "@/sdk/plugin"
import { localPlugin, localPlugins } from "./local-plugins"

/** Built-in plugins first, then local plugins that built at least once. */
export function getPlugin(type: string): PluginDefinition | undefined {
  return builtinPlugins.get(type) ?? localPlugin(type)?.plugin
}

export function pluginTypes(): string[] {
  return [...builtinPlugins.keys(), ...localPlugins().flatMap((p) => (p.plugin ? [p.id] : []))]
}
