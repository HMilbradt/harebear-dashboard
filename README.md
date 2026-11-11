# harebear-dashboard

A self-hosted start page and homelab dashboard. Pages are YAML files, widgets are typed plugins, and every edit shows up in open browsers within a second. Built on TanStack Start and [harebear-ui](https://github.com/HMilbradt/harebear-ui).

> Early. The config format may still change before v0.1.0.

## Run it

```bash
mkdir -p config/pages
docker run -d --name harebear-dashboard -p 3000:3000 \
  -v "$PWD/config:/config:ro" \
  ghcr.io/hmilbradt/harebear-dashboard:main
```

Open http://localhost:3000 and add a page:

```yaml
# config/pages/home.yaml
title: Home
width: slim
center: true
columns:
  - size: full
    widgets:
      - id: search
        type: search
      - id: news
        type: rss
        feeds:
          - url: https://hnrss.org/frontpage
  - size: small
    widgets:
      - id: weather
        type: weather
        location: Vancouver, British Columbia, Canada
```

Save it and the page appears. `examples/config/` has a fuller setup and `docker-compose.yaml` adds the read-only Docker API the `docker` widget needs.

## Sign in

`auth.mode` in `dashboard.yaml` is `none` (the default: restrict access at your proxy), `password`, or `proxy`.

```yaml
auth:
  mode: password
  passwordHash: env:DASHBOARD_PASSWORD_HASH
```

Make the hash with `docker run --rm -it ghcr.io/hmilbradt/harebear-dashboard:main harebear-dashboard hash-password` and pass it to the container as `DASHBOARD_PASSWORD_HASH`. Sessions last 30 days; changing the password signs everyone out. Ten wrong passwords in 15 minutes lock sign in for that address.

```yaml
auth:
  mode: proxy # Authelia, Authentik, oauth2-proxy...
  proxy:
    header: Remote-User
    trustedProxies: [192.168.1.10/32]
```

The header is believed only from those addresses. `/healthz` stays public.

## Config

- `dashboard.yaml`: title, `header` (`icon`, `title`, `showTitle`, `homeInNav`), `theme` (`accent`, `radius`, `mode`), and `search` (`engine`, `bangs`). The header icon always links to the first page; with `homeInNav: false` only the other pages appear as tabs.
- `pages/<slug>.yaml`: one page each, served at `/<slug>`; the first by `order` is also `/`. A page has `title`, `order`, `width` (`slim`, `default`, `wide`), `center`, and one to three `columns` (`size: small | full`, at least one full).
- Every widget has `id` (unique on the page) and `type`, plus optional `title`, `titleUrl`, `refresh` (`30s`, `5m`, `1h`, `never`) and `hideHeader`. Its other keys are the widget's options, checked strictly: a typo is an error with a file and line number.
- `type: group` (tabs) and `type: split` (side by side) hold other widgets in `widgets:`.
- Any value can be `env:NAME`. Secrets must be: `secrets: { token: env:SPEEDTEST_TOKEN }`. A literal secret fails validation.
- An invalid edit keeps the last good config running and shows the errors at the bottom of the page.

## Widgets

| Type                | What it shows                                           | Needs                 |
| :------------------ | :------------------------------------------------------ | :-------------------- |
| `search`            | Search box, `/` to focus, bangs like `!yt cats`         |                       |
| `clock`             | Time, date, extra time zones                            |                       |
| `calendar`          | This month                                              |                       |
| `bookmarks`         | Groups of links with icons (`si:`, `di:` or https URLs) |                       |
| `monitor`           | Up/down and latency for a list of sites                 |                       |
| `weather`           | Current, next hours, high and low (Open-Meteo)          |                       |
| `rss`               | RSS and Atom feeds, merged by date                      |                       |
| `speedtest-tracker` | Latest Speedtest Tracker result vs. average             | `secrets.token`       |
| `seerr`             | Trending or popular media from Seerr / Overseerr        | `secrets.apiKey`      |
| `server-stats`      | CPU, memory, disks, load, uptime of the host            |                       |
| `docker`            | Containers and their state                              | A Docker socket proxy |
| `http`              | Any JSON API as stats, key-value pairs, a list, links or a table, no code | |

Options for each are in `src/plugins/<type>/server.ts`.

```yaml
# The http widget: Speedtest Tracker without a plugin
- id: speed
  type: http
  url: https://speedtest.example.com/api/v1/results/latest
  headers:
    authorization: Bearer {secret.token}
  secrets:
    token: env:SPEEDTEST_TOKEN
  view: stats
  fields:
    - { label: Down, path: data.download_bits, format: number, scale: 0.000001, decimals: 1, unit: Mbps }
    - { label: Ping, path: data.ping, format: number, decimals: 0, unit: ms }
```

## Your own widgets

Mount a folder at `/plugins` (`PLUGINS_DIR`). Each subfolder is one widget type, named after the folder:

```
plugins/github-repo/
  server.ts   export default definePlugin({ id, name, description, options, secrets?, hosts, load })
  view.tsx    export default function View({ data }) built from harebear-dashboard/sdk components
```

`examples/plugins/github-repo` is a complete one, and `harebear-dashboard new-plugin <id>` scaffolds another. The dashboard compiles plugins with esbuild at startup and again on every save; open pages pick up the new view without a reload. A broken edit keeps the last good build running and shows the error on the widget.

Plugins are trusted code: only mount folders you wrote or reviewed. Guardrails, not a sandbox: `server.ts` reaches the network only through `ctx.fetch` (limited to the hosts it declares; the global `fetch` and `process` are shadowed), Node built-ins, other packages, `eval` and dynamic `import()` are refused, and views cannot use `dangerouslySetInnerHTML`. The browser only ever receives what `load` returns.

## How it stays safe

- The browser asks for data by page and widget id only. Options, URLs and secrets stay on the server; a test renders a page with a sentinel secret and fails if it appears.
- Widgets reach the network only through a broker that allows the hosts the widget declared, follows redirects only within one host, and caps time and size.
- The Content-Security-Policy allows connections only to the dashboard itself, and images only from hosts the enabled widgets declared.

## Develop

```bash
pnpm install
cp -r examples/config config
pnpm dev        # http://localhost:3000
pnpm check      # lint, typecheck, build, tests
```

See [AGENTS.md](AGENTS.md) for how the code is laid out and how to add a widget.

## License

MIT
