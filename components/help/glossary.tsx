'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

interface Term {
  term: string
  short: string
  detail: string
  example: string
  tags: string[]
}

const TERMS: Term[] = [
  {
    term: 'GEX (Gamma Exposure)',
    short: 'How much hedging dealers must do per 1% move.',
    detail:
      'Net gamma exposure estimates how many shares market makers buy or sell to stay hedged as price moves. Positive GEX means dealers sell rallies and buy dips (dampening moves); negative GEX means they chase price (amplifying moves).',
    example:
      'If SPY sits in strong positive GEX, intraday ranges tend to compress and dips get bought.',
    tags: ['gamma', 'dealers', 'hedging'],
  },
  {
    term: 'Gamma Flip',
    short: 'The price where net gamma crosses from positive to negative.',
    detail:
      'Above the flip, dealer hedging tends to stabilize price. Below it, hedging tends to accelerate moves. The flip is one of the most watched regime boundaries.',
    example:
      'Losing the gamma flip at 745 often precedes a faster, trendier tape.',
    tags: ['gamma', 'regime'],
  },
  {
    term: 'Call Wall / Put Wall',
    short: 'Strikes with the largest call or put gamma concentration.',
    detail:
      'The call wall often acts as a ceiling where upside stalls; the put wall often acts as a floor where downside slows. They mark where dealer hedging is heaviest.',
    example: 'Price grinding into a call wall at 750 frequently pins there into expiry.',
    tags: ['walls', 'gamma', 'levels'],
  },
  {
    term: 'Open Interest (OI)',
    short: 'Total number of option contracts currently outstanding.',
    detail:
      'OI shows where positioning has built up over time. Large OI at a strike means more hedging pressure concentrated there.',
    example: 'A strike with rising OI and volume is attracting fresh positioning.',
    tags: ['options', 'positioning'],
  },
  {
    term: 'Implied Volatility (IV)',
    short: "The market's expected forward volatility priced into options.",
    detail:
      'Higher IV means larger expected moves and richer option premiums. ATM IV is a quick read on how much movement the market is pricing for a given expiry.',
    example: 'A 23% ATM IV implies a larger daily range than a 12% IV day.',
    tags: ['volatility', 'options'],
  },
  {
    term: 'Vanna',
    short: 'How delta changes as implied volatility changes.',
    detail:
      'Vanna links volatility and directional hedging. Falling IV in positive-gamma regimes can create supportive vanna flows that lift price.',
    example: 'A calm, IV-crushing drift higher is often a vanna tailwind.',
    tags: ['greeks', 'volatility'],
  },
  {
    term: 'Charm',
    short: 'How delta decays as time passes (toward expiry).',
    detail:
      'Charm drives predictable hedging into expiration, especially on OPEX days, as option deltas roll toward 0 or 1.',
    example: 'Friday afternoon pins are frequently charm-driven.',
    tags: ['greeks', 'time'],
  },
  {
    term: 'Attraction',
    short: 'A level price is magnetically drawn toward.',
    detail:
      'In FLOWSTERS, an attraction node marks a high-gamma strike that tends to pull price toward it and pin around it.',
    example: 'Price hovering just under an attraction node often drifts up to tag it.',
    tags: ['node', 'levels'],
  },
  {
    term: 'Continuation',
    short: 'A level that, once broken, tends to extend the move.',
    detail:
      'Continuation nodes flag where a breakout is more likely to keep going rather than reverse, based on positioning above/below.',
    example: 'Clearing a continuation node at 810 can open a faster leg higher.',
    tags: ['node', 'breakout'],
  },
  {
    term: 'Reversal',
    short: 'A level where price is more likely to turn.',
    detail:
      'Reversal nodes mark zones where hedging or exhausted positioning tends to reject price and flip direction.',
    example: 'A rejection wick into a reversal node is a classic fade signal.',
    tags: ['node', 'levels'],
  },
  {
    term: 'Confidence',
    short: 'A relative score for how strong a setup looks right now.',
    detail:
      'Confidence blends level strength, gamma regime, and flow confirmation into a single 0–100 read. It is a prioritization aid, not a probability or a guarantee.',
    example: 'A 70% confidence setup is worth more attention than a 30% one — but neither is a promise.',
    tags: ['scoring', 'signals'],
  },
]

export function Glossary() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TERMS
    return TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.short.toLowerCase().includes(q) ||
        t.detail.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q)),
    )
  }, [query])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms — GEX, gamma flip, walls, vanna…"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No terms match “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {results.map((t) => (
            <article
              key={t.term}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">{t.term}</h3>
              <p className="text-[13px] font-medium text-primary">{t.short}</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t.detail}
              </p>
              <p className="rounded-lg bg-secondary/50 px-3 py-2 text-[12px] leading-relaxed text-foreground/80">
                <span className="font-medium text-text-muted">Example: </span>
                {t.example}
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="rounded-xl border border-border bg-card px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Data methodology & limitations: </span>
        Gamma, walls, and levels are estimates derived from options positioning and
        can be stale, incomplete, or revised as new data arrives. FLOWSTERS is an
        educational analytics tool, not investment advice, and nothing here
        guarantees future results.
      </p>
    </div>
  )
}
