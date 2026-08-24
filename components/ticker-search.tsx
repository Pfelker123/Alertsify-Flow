'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Clock, Loader2, Search, TrendingUp } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { cn } from '@/lib/utils'
import type { SymbolResult } from '@/app/api/symbols/search/route'
import type { DataEnvelope } from '@/lib/market/types'

const RECENTS_KEY = 'flowsters:recent-tickers'
const MAX_RECENTS = 6
const SYMBOL_RE = /^[A-Z][A-Z.]{0,5}$/

const fetcher = async (url: string): Promise<DataEnvelope<SymbolResult[]>> => {
  const res = await fetch(url)
  return res.json()
}

function loadRecents(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveRecent(symbol: string): string[] {
  const next = [symbol, ...loadRecents().filter((s) => s !== symbol)].slice(0, MAX_RECENTS)
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private-mode errors */
  }
  return next
}

export function TickerSearch() {
  const { setSymbol } = useFilters()
  const router = useRouter()
  const pathname = usePathname()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRecents(loadRecents())
  }, [])

  // Debounce the query so we don't hit the search endpoint on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toUpperCase()), 220)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useSWR<DataEnvelope<SymbolResult[]>>(
    debounced ? `/api/symbols/search?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  const results = data?.data ?? []
  const searchError = data?.meta.source === 'unavailable' ? data.meta.error : undefined

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [debounced])

  function commit(symbol: string) {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return
    setSymbol(sym)
    setRecents(saveRecent(sym))
    setQuery('')
    setDebounced('')
    setOpen(false)
    if (pathname !== '/' && pathname !== '/charting') router.push('/')
  }

  // Enter with no highlighted suggestion: validate the typed symbol live so
  // ANY provider-supported ticker resolves (no local allow-list gate).
  async function submitTyped() {
    const sym = query.trim().toUpperCase()
    if (!sym || !SYMBOL_RE.test(sym)) return
    if (results[activeIndex]) {
      commit(results[activeIndex].symbol)
      return
    }
    setPending(true)
    try {
      const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(sym)}`)
      const env = (await res.json()) as DataEnvelope<SymbolResult[]>
      const match = env.data?.find((r) => r.symbol === sym && r.validated)
      if (match) commit(match.symbol)
    } finally {
      setPending(false)
    }
  }

  const showDropdown = open && (query.length > 0 || recents.length > 0)

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      void submitTyped()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-44 shrink-0 sm:w-56">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search any ticker..."
        aria-label="Search ticker"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="ticker-search-listbox"
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-border bg-secondary pl-9 pr-8 text-sm uppercase text-foreground outline-none placeholder:normal-case placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
      />
      {(isLoading || pending) && (
        <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showDropdown && (
        <div
          id="ticker-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          {/* Recent tickers when the box is empty */}
          {query.length === 0 && recents.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </p>
              {recents.map((sym) => (
                <button
                  key={sym}
                  onClick={() => commit(sym)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span className="font-semibold">{sym}</span>
                </button>
              ))}
            </div>
          )}

          {/* Live results */}
          {query.length > 0 && (
            <div className="py-1">
              {searchError ? (
                <p className="px-3 py-2 text-sm text-bear">{searchError}</p>
              ) : results.length === 0 && !isLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {SYMBOL_RE.test(debounced)
                    ? `No supported symbol matches "${debounced}".`
                    : 'Keep typing a ticker symbol...'}
                </p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={r.symbol}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(r.symbol)}
                    disabled={!r.hasOptions}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm',
                      i === activeIndex && 'bg-accent',
                      !r.hasOptions && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold">{r.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {r.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {r.validated && (
                        <TrendingUp className="size-3 text-bull" aria-label="Verified" />
                      )}
                      {!r.hasOptions && (
                        <span className="text-[10px] uppercase text-muted-foreground">
                          No options
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
