import { NextResponse } from "next/server"
import { uwFetch, hasUWKey, UWError } from "@/lib/uw/client"
import { isDemoMode, ok, demo, unavailable } from "@/lib/market/types"
import { TICKER_NAMES } from "@/lib/mock-data"

// All-ticker symbol search. There is intentionally NO hard-coded allow-list:
// any provider-supported symbol resolves. Local names are used ONLY as
// autocomplete hints; the authoritative validation is a live UW lookup so the
// universe is never limited to a bundled array.

export const dynamic = "force-dynamic"
export const revalidate = 0

const ENDPOINT = "symbols/search"
const SYMBOL_RE = /^[A-Z][A-Z.]{0,5}$/

export interface SymbolResult {
  symbol: string
  name: string
  sector?: string
  hasOptions: boolean
  /** True when confirmed against the live provider (not just a local hint). */
  validated: boolean
}

interface UWInstrumentInfo {
  symbol?: string
  full_name?: string
  sector?: string
  has_options?: boolean
}

/** Local prefix hints (convenience only — never gates the result set). */
function localHints(q: string): SymbolResult[] {
  const out: SymbolResult[] = []
  for (const [symbol, name] of Object.entries(TICKER_NAMES)) {
    if (symbol.startsWith(q) || name.toUpperCase().includes(q)) {
      out.push({ symbol, name, hasOptions: true, validated: false })
    }
    if (out.length >= 8) break
  }
  return out.sort((a, b) => {
    // Exact/prefix symbol matches rank above name-substring matches.
    const ap = a.symbol.startsWith(q) ? 0 : 1
    const bp = b.symbol.startsWith(q) ? 0 : 1
    return ap - bp || a.symbol.localeCompare(b.symbol)
  })
}

/** Confirm a single symbol against the live provider. */
async function validateSymbol(sym: string): Promise<SymbolResult | null> {
  try {
    const info = await uwFetch<UWInstrumentInfo>(`/api/stock/${sym}/info`, {}, 300)
    if (!info) return null
    return {
      symbol: sym,
      name: info.full_name ?? TICKER_NAMES[sym] ?? sym,
      sector: info.sector,
      hasOptions: info.has_options !== false,
      validated: true,
    }
  } catch (err) {
    // A 404/422 means the symbol is not supported — that's a valid "no match"
    // answer, not a server error. Re-throw rate-limit/permission errors.
    if (err instanceof UWError && (err.status === 429 || err.status === 403)) {
      throw err
    }
    return null
  }
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toUpperCase()
  if (!q) {
    return NextResponse.json(ok<SymbolResult[]>([], { endpoint: ENDPOINT }))
  }

  // Demo mode: serve local hints only, clearly flagged.
  if (isDemoMode()) {
    return NextResponse.json(demo(localHints(q), { endpoint: ENDPOINT }))
  }

  if (!hasUWKey()) {
    return NextResponse.json(
      unavailable<SymbolResult[]>({
        endpoint: ENDPOINT,
        error: "UNUSUAL_WHALES_API_KEY is not configured on the server.",
      }),
      { status: 503 },
    )
  }

  const hints = localHints(q)

  try {
    // Validate the exact typed symbol live so ANY supported ticker resolves,
    // even when it isn't in the local hint list.
    const exact = SYMBOL_RE.test(q) ? await validateSymbol(q) : null

    // Merge: the validated exact match first, then de-duplicated local hints.
    const seen = new Set<string>()
    const results: SymbolResult[] = []
    if (exact) {
      results.push(exact)
      seen.add(exact.symbol)
    }
    for (const h of hints) {
      if (!seen.has(h.symbol)) {
        results.push(h)
        seen.add(h.symbol)
      }
    }

    return NextResponse.json(ok(results, { endpoint: ENDPOINT }))
  } catch (err) {
    const status = err instanceof UWError ? err.status : 500
    const message =
      status === 429
        ? "Rate limited by the market data provider. Try again shortly."
        : status === 403
          ? "Your market data plan does not permit symbol lookups."
          : "Symbol search is temporarily unavailable."
    return NextResponse.json(
      unavailable<SymbolResult[]>({ endpoint: ENDPOINT, error: message }),
      { status: status === 429 || status === 403 ? status : 502 },
    )
  }
}
