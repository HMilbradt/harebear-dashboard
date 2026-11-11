import type { QueryClient } from "@tanstack/react-query"
import { QueryClientProvider } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router"
import { ThemeProvider, ThemeScript } from "harebear-ui"
import type { ReactNode } from "react"
import { DashboardProvider } from "@/client/dashboard-context"
import { useLiveReload } from "@/client/live-reload"
import { getShell } from "@/server/fns"
import css from "../styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => getShell(),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: loaderData?.title ?? "Dashboard" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: Root,
})

function LiveReload() {
  useLiveReload()
  return null
}

function Root() {
  const shell = Route.useLoaderData()
  const { options } = useRouter()
  return (
    <Document mode={shell.theme.mode}>
      <QueryClientProvider client={options.context.queryClient}>
        <ThemeProvider defaultMode={shell.theme.mode} accent={shell.theme.accent} radius={shell.theme.radius}>
          <DashboardProvider value={shell}>
            <LiveReload />
            <Outlet />
          </DashboardProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Document>
  )
}

function Document({ mode, children }: { mode: "system" | "light" | "dark"; children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultMode={mode} />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
