import { createFileRoute } from "@tanstack/react-router"
import { PageView } from "@/client/page-view"
import { getPage } from "@/server/fns"

export const Route = createFileRoute("/$page")({
  loader: ({ params }) => getPage({ data: { slug: params.page } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.title }] : [] }),
  component: PageRoute,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center text-muted-foreground">No page with that name.</div>
  ),
})

function PageRoute() {
  const page = Route.useLoaderData()
  return page ? <PageView page={page} /> : null
}
