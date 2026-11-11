import "@tanstack/react-start/server-only"
import type { BrokerInit, BrokerResponse } from "@/sdk/plugin"

const DEFAULT_TIMEOUT = 10_000
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3

export class BrokerError extends Error {
  override name = "BrokerError"
}

/**
 * The only network access a plugin gets. Refuses hosts the plugin did not
 * declare, follows redirects only within the same host, times out, and caps
 * the response size.
 */
export function createBroker(allowedHosts: string[], parentSignal?: AbortSignal) {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()))

  return async function brokerFetch(input: string | URL, init: BrokerInit = {}): Promise<BrokerResponse> {
    let url = new URL(input)
    check(url)
    const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT
    const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES
    const signals = [AbortSignal.timeout(timeoutMs)]
    if (parentSignal) signals.push(parentSignal)
    const signal = AbortSignal.any(signals)

    let res: Response
    for (let hop = 0; ; hop++) {
      try {
        res = await fetch(url, {
          method: init.method ?? "GET",
          headers: { "user-agent": "harebear-dashboard", ...init.headers },
          body: init.body,
          redirect: "manual",
          signal,
        })
      } catch (err) {
        if (signal.aborted) throw new BrokerError(`${url.host}: timed out after ${timeoutMs} ms`)
        throw new BrokerError(`${url.host}: ${describe(err)}`)
      }
      const location = res.headers.get("location")
      if (res.status >= 300 && res.status < 400 && location && init.followRedirects !== false) {
        if (hop >= MAX_REDIRECTS) throw new BrokerError(`${url.host}: too many redirects`)
        const next = new URL(location, url)
        if (next.host !== url.host) {
          throw new BrokerError(`${url.host}: refused redirect to another host (${next.host})`)
        }
        await res.body?.cancel()
        url = next
        continue
      }
      break
    }

    let body: Promise<string> | undefined
    const read = () => {
      body ??= readCapped(res, maxBytes, url.host)
      return body
    }
    return {
      ok: res.ok,
      status: res.status,
      url: url.toString(),
      headers: res.headers,
      text: read,
      json: async <T>() => {
        const text = await read()
        try {
          return JSON.parse(text) as T
        } catch {
          throw new BrokerError(`${url.host}: response is not JSON (HTTP ${res.status})`)
        }
      },
    }
  }

  function check(url: URL) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new BrokerError(`Refused ${url.protocol} URL; only http and https are allowed`)
    }
    if (!allowed.has(url.host.toLowerCase())) {
      throw new BrokerError(`Refused ${url.host}: not in this widget's declared hosts`)
    }
  }
}

async function readCapped(res: Response, maxBytes: number, host: string): Promise<string> {
  if (!res.body) return ""
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new BrokerError(`${host}: response larger than ${Math.round(maxBytes / 1024)} KB`)
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause
    return cause?.code ?? cause?.message ?? err.message
  }
  return String(err)
}
