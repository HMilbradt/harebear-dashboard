import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "harebear-ui"
import { CircleAlert, TriangleAlert } from "lucide-react"
import * as React from "react"
import { bare, views } from "@/plugins/views"
import { type ClientNode, getWidget, type WidgetMeta, type WidgetResult } from "@/server/fns"

class ViewBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) return <ErrorState message={`The view crashed: ${this.state.error.message}`} />
    return this.props.children
  }
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  )
}

function useWidget(page: string, version: number, w: WidgetMeta, initial?: WidgetResult) {
  return useQuery({
    queryKey: ["widget", page, w.id, version],
    queryFn: () => getWidget({ data: { page, id: w.id } }),
    initialData: initial,
    initialDataUpdatedAt: initial?.updatedAt,
    staleTime: 30_000,
    refetchInterval: w.refreshMs > 0 ? Math.max(w.refreshMs, 10_000) : false,
    refetchOnWindowFocus: w.refreshMs > 0,
  })
}

function WidgetBody({ w, result, pending }: { w: WidgetMeta; result?: WidgetResult; pending: boolean }) {
  const View = views[w.type]
  if (!View) return <ErrorState message={`No view for widget type ${w.type}`} />
  if (!result) {
    return pending ? (
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    ) : null
  }
  if (result.status === "error" && result.data === undefined) return <ErrorState message={result.error} />
  return (
    <ViewBoundary>
      <View data={result.data} />
    </ViewBoundary>
  )
}

export function WidgetCard({
  page,
  version,
  w,
  initial,
}: {
  page: string
  version: number
  w: WidgetMeta
  initial?: WidgetResult
}) {
  const q = useWidget(page, version, w, initial)
  const result = q.data
  const stale = result?.status === "error" && result.data !== undefined
  if (bare.has(w.type)) return <WidgetBody w={w} result={result} pending={q.isPending} />
  return (
    <Card size="sm" className="@container gap-3" data-widget={w.id}>
      {!w.hideHeader && (
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="truncate">
            {w.titleUrl ? (
              <a href={w.titleUrl} target="_blank" rel="noreferrer" className="hover:underline">
                {w.title}
              </a>
            ) : (
              w.title
            )}
          </CardTitle>
          {stale && (
            <Tooltip>
              <TooltipTrigger aria-label="Showing older data">
                <TriangleAlert className="size-4 text-warning" />
              </TooltipTrigger>
              <TooltipContent>Showing older data. Last refresh failed: {result.error}</TooltipContent>
            </Tooltip>
          )}
        </CardHeader>
      )}
      <CardContent>
        <WidgetBody w={w} result={result} pending={q.isPending} />
      </CardContent>
    </Card>
  )
}

function GroupCard({
  page,
  version,
  node,
  initial,
}: {
  page: string
  version: number
  node: Extract<ClientNode, { kind: "group" }>
  initial: Record<string, WidgetResult>
}) {
  const widgets = node.children.flatMap((c) => (c.kind === "widget" ? [c.widget] : []))
  const first = widgets[0]
  if (!first) return null
  return (
    <Tabs defaultValue={first.id} className="gap-2">
      <TabsList>
        {widgets.map((w) => (
          <TabsTrigger key={w.id} value={w.id}>
            {w.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {widgets.map((w) => (
        <TabsContent key={w.id} value={w.id}>
          <WidgetCard page={page} version={version} w={{ ...w, hideHeader: true }} initial={initial[w.id]} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function LayoutNodeView({
  page,
  version,
  node,
  initial,
}: {
  page: string
  version: number
  node: ClientNode
  initial: Record<string, WidgetResult>
}) {
  if (node.kind === "widget")
    return <WidgetCard page={page} version={version} w={node.widget} initial={initial[node.widget.id]} />
  if (node.kind === "group") return <GroupCard page={page} version={version} node={node} initial={initial} />
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {node.children.map((c, i) => (
        <LayoutNodeView key={i} page={page} version={version} node={c} initial={initial} />
      ))}
    </div>
  )
}
