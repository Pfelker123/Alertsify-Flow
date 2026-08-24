import { NextResponse } from "next/server"
import { hasUWKey, uwFetch } from "@/lib/uw/client"
import { isDemoMode } from "@/lib/market/types"

// Health route: probes each endpoint the app depends on and reports per-input
// status. Never returns the API key or any secret material.

interface Check {
  name: string
  ok: boolean
  status: number | null
  ms: number
  error?: string
}

async function probe(name: string, path: string): Promise<Check> {
  const t0 = Date.now()
  try {
    // Cache probes for 25s so the health poll can't itself cause rate limiting.
    await uwFetch(path, {}, 25, 6000)
    return { name, ok: true, status: 200, ms: Date.now() - t0 }
  } catch (err) {
    const anyErr = err as { status?: number; message?: string }
    return {
      name,
      ok: false,
      status: typeof anyErr.status === "number" ? anyErr.status : null,
      ms: Date.now() - t0,
      error: anyErr.message ?? "error",
    }
  }
}

export async function GET() {
  const demoMode = isDemoMode()
  const keyConfigured = hasUWKey()

  if (!keyConfigured) {
    return NextResponse.json(
      {
        keyConfigured: false,
        demoMode,
        overall: demoMode ? "demo" : "unconfigured",
        passing: 0,
        total: 0,
        checks: [],
        message: demoMode
          ? "Demo mode is enabled; live checks skipped."
          : "UNUSUAL_WHALES_API_KEY is not configured.",
        checkedAt: new Date().toISOString(),
      },
      { status: demoMode ? 200 : 503 },
    )
  }

  // Probe the core endpoints only. Kept intentionally small and cached so the
  // health poll adds negligible load to the rate-limited upstream API.
  const sym = "SPY"
  const checks = await Promise.all([
    probe("quote", `/api/stock/${sym}/stock-state`),
    probe("candles", `/api/stock/${sym}/ohlc/5m`),
    probe("gexByStrike", `/api/stock/${sym}/greek-exposure/strike`),
    probe("optionsFlow", `/api/option-trades/flow-alerts`),
  ])

  const passing = checks.filter((c) => c.ok).length
  // A single transient failure (e.g. a 429) should not flip the global badge
  // to "degraded"; require at least two failing core checks for that.
  const failing = checks.length - passing
  const overall =
    failing === 0 ? "healthy" : passing === 0 ? "down" : failing <= 1 ? "healthy" : "degraded"

  return NextResponse.json({
    keyConfigured: true,
    demoMode,
    overall,
    passing,
    total: checks.length,
    checks,
    checkedAt: new Date().toISOString(),
  })
}
