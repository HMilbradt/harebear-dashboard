import { createFileRoute } from "@tanstack/react-router"
import { EmptyState, PageView } from "@/client/page-view"
import { getPage } from "@/server/fns"

export const Route = createFileRoute("/")({
  loader: () => getPage({ data: {} }),
  component: Index,
})

function Index() {
  const page = Route.useLoaderData()
  return page ? <PageView page={page} /> : <EmptyState />
}
