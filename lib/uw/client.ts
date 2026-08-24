import "server-only"

const BASE_URL = "https://api.unusualwhales.com"

export class UWError extends Error {
  status: number
  /** Seconds to wait before retrying, parsed from a 429 Retry-After header. */
  retryAfter?: number
  constructor(message: string, status: number, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
    this.name = "UWError"
  }
}

export function hasUWKey(): boolean {
  return Boolean(process.env.UNUSUAL_WHALES_API_KEY)
}

type Params = Record<string, string | number | boolean | undefined | null>

/** Default upstream timeout (ms). UW endpoints are usually sub-second. */
const DEFAULT_TIMEOUT_MS = 8_000

/**
 * Server-only fetch wrapper for the Unusual Whales REST API.
 * - Adds the required Authorization + UW-CLIENT-API-ID headers.
 * - Enforces a timeout via AbortController so a hung upstream can't stall SSR.
 * - Surfaces rate-limit (429) with Retry-After as a typed UWError.
 * - Uses the Next.js data cache with a per-call revalidate window.
 * - Returns the `data` payload (UW wraps every response in `{ data }`).
 * - Never logs the API key.
 */
export async function uwFetch<T = unknown>(
  path: string,
  params: Params = {},
  revalidate = 30,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const key = process.env.UNUSUAL_WHALES_API_KEY
  if (!key) throw new UWError("UNUSUAL_WHALES_API_KEY is not set", 401)

  const url = new URL(path, BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
        "UW-CLIENT-API-ID": "100001",
        Accept: "application/json",
      },
      next: { revalidate },
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new UWError(`UW ${path} timed out after ${timeoutMs}ms`, 504)
    }
    throw new UWError(
      `UW ${path} network error: ${(err as Error).message}`,
      502,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"))
    throw new UWError(
      `UW ${path} rate limited`,
      429,
      Number.isFinite(ra) ? ra : undefined,
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new UWError(
      `UW ${path} failed: ${res.status} ${body.slice(0, 200)}`,
      res.status,
    )
  }

  const json = (await res.json()) as { data?: T } & Record<string, unknown>
  // Most endpoints wrap the payload in `data`; a few return the object directly.
  return (json.data !== undefined ? json.data : (json as unknown as T)) as T
}

/** Safe numeric parse for the many stringified numbers the API returns. */
export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : fallback
}
