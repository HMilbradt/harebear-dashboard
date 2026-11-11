import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import * as React from "react"

/** Listens on /events and refetches the page and every widget when the config changes. */
export function useLiveReload() {
  const router = useRouter()
  const queryClient = useQueryClient()
  React.useEffect(() => {
    let seen: number | undefined
    const es = new EventSource("/events")
    es.addEventListener("config", (e) => {
      const { version } = JSON.parse((e as MessageEvent).data) as { version: number }
      if (seen !== undefined && version !== seen) {
        void router.invalidate()
        void queryClient.invalidateQueries()
      }
      seen = version
    })
    return () => es.close()
  }, [router, queryClient])
}
