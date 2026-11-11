# harebear-dashboard: agent guide

A start page and homelab dashboard. TanStack Start (React 19, SSR), harebear-ui, Tailwind v4, zod 4, TypeScript 7, pnpm, Biome (no semicolons, double quotes), Vitest.

## Commands

| Command                    | What it does                                                            |
| :------------------------- | :---------------------------------------------------------------------- |
| `pnpm dev`                 | Dev server on :3000, reading `./config` (copy `examples/config` first). |
| `pnpm check`               | Lint, typecheck, build, tests. Run before saying you are done.          |
| `pnpm build && pnpm start` | Production server (`server.mjs`, srvx) on :3000.                        |
| `node dist/cli.mjs validate config` | Check a config the way the server does (also `docs`, `data <page>/<widget>`, `schema`, `new-plugin`). |

`CONFIG_DIR` sets the config directory (default `./config`, `/config` in the image).

## Layout

```
src/server/config.ts   YAML + zod: dashboard.yaml and pages/*.yaml -> LoadedConfig, errors with file/line/path
src/server/store.ts    Watches CONFIG_DIR (fs.watch plus a 3s stat poll), keeps the last good config, notifies /events
src/server/runner.ts   Runs a widget's load with its options, resolved secrets and broker; TTL cache, stale data on error
src/server/broker.ts   ctx.fetch: declared hosts only, same-host redirects, timeout, size cap
src/server/fns.ts      Server functions the UI calls: getShell, getPage (prefetch with a deadline), getWidget
src/server/csp.ts      Content-Security-Policy from the enabled widgets' imageHosts
src/routes/            /, /$page, /events (SSE), /healthz
src/client/            Page layout, widget card chrome, live reload
src/sdk/               Plugin API (definePlugin, ViewProps) and the sealed view kit (no className/style)
src/plugins/<type>/    server.ts (definePlugin: options, secrets, hosts, load) and view.tsx (default export)
src/plugins/server.ts  Registry of plugin definitions (server only)
src/plugins/views.ts   Registry of views (browser)
src/server/local-plugins.ts  PLUGINS_DIR compiler (esbuild, shims, guardrails, live rebuild)
src/server/registry.ts Built-in plus local plugin lookup
src/server/schema.ts   JSON Schema for dashboard.yaml and pages (one entry per widget type)
src/cli/index.ts       The harebear-dashboard CLI, bundled by scripts/build-cli.mjs with dist/serve.mjs
src/server/auth.ts, session.ts  Password and proxy sign in; src/start.ts guards every request
src/client/local-views.tsx  Loads local plugin views (registered on the server, lazy in the browser)
```

## Adding a widget

1. `src/plugins/<type>/server.ts`: `export default definePlugin({ id, name, description, options: z.object(...), secrets?, hosts, imageHosts?, refresh, load })`. `load` gets `{ options, secrets, fetch, widget, signal }` and returns JSON. Reach the network only with `ctx.fetch`; list every host it needs in `hosts`.
2. `src/plugins/<type>/view.tsx`: `export default function View({ data }: ViewProps<typeof plugin>)`, built from `@/sdk` components. Views never get options or secrets, only what `load` returned.
3. Register both in `src/plugins/server.ts` and `src/plugins/views.ts`, add a row to the README table, and use it in `examples/config` if it needs no account.
4. `pnpm check`.

## Rules

- Nothing in `src/server/` or a plugin's `server.ts` may be imported by browser code. Server modules start with `import "@tanstack/react-start/server-only"`; server functions import them dynamically inside handlers.
- Never send options, URLs from options, or secrets to the browser. `test/leak.test.ts` guards this.
- Kit components take props, not classes. Every class string is a complete literal (Tailwind scans source).
- Keep `examples/config` generic: no personal hosts or names.
