'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type UTCTimestamp,
  type Time,
} from 'lightweight-charts'
import { Star, TrendingUp, CornerUpLeft, ArrowUp, ArrowDown, Activity } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { useGexBoard } from '@/lib/uw/hooks'
import { allLevels } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { Candle } from '@/lib/types'

// lightweight-charts ships its own strict color parser that only accepts
// hex / rgb(a) / named colors — it chokes on oklch()/lab(). The app's design
// tokens are authored in oklch/hex, so we paint each resolved value onto a 1x1
// canvas and read the pixel back as sRGB before handing it to the chart.
let _swatch: HTMLCanvasElement | null = null
function toRgb(color: string): { r: number; g: number; b: number } {
  if (typeof document === 'undefined') return { r: 136, g: 136, b: 136 }
  _swatch ||= document.createElement('canvas')
  const ctx = _swatch.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = '#000'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return { r, g, b }
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const raw =
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  const { r, g, b } = toRgb(raw)
  return `rgb(${r}, ${g}, ${b})`
}

function trailColor(kind: 'sticky' | 'slippery', strength: number) {
  const token = kind === 'sticky' ? '--bull' : '--bear'
  const pct = Math.round(35 + strength * 55)
  return `color-mix(in oklch, var(${token}) ${pct}%, transparent)`
}

function cssVarAlpha(name: string, alpha: number, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const raw =
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  const { r, g, b } = toRgb(raw)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Visual identity for each level type: line color var, pill icon, accent
// classes, and a plain-English meaning shown on hover.
type LevelStyle = {
  varName: string
  Icon: typeof Star
  text: string
  border: string
  glow: string
  meaning: string
}

const LEVEL_STYLE: Record<string, LevelStyle> = {
  Attraction: {
    varName: '--attraction',
    Icon: Star,
    text: 'text-attraction',
    border: 'border-attraction/45',
    glow: 'shadow-attraction/10',
    meaning: 'Price magnet — likely to pull and anchor price under current positioning.',
  },
  Continuation: {
    varName: '--bull',
    Icon: TrendingUp,
    text: 'text-bull',
    border: 'border-bull/45',
    glow: 'shadow-bull/10',
    meaning: 'Acceptance here can support directional continuation.',
  },
  Reversal: {
    varName: '--reversal',
    Icon: CornerUpLeft,
    text: 'text-reversal',
    border: 'border-reversal/45',
    glow: 'shadow-reversal/10',
    meaning: 'Concentrated opposing positioning — a potential turn level.',
  },
  'Buy Above': {
    varName: '--bull',
    Icon: ArrowUp,
    text: 'text-bull',
    border: 'border-bull/45',
    glow: 'shadow-bull/10',
    meaning: 'Scenario trigger — bias turns constructive above this price.',
  },
  'Sell Below': {
    varName: '--bear',
    Icon: ArrowDown,
    text: 'text-bear',
    border: 'border-bear/45',
    glow: 'shadow-bear/10',
    meaning: 'Scenario trigger — bias turns defensive below this price.',
  },
  'Gamma Flip': {
    varName: '--spot',
    Icon: Activity,
    text: 'text-spot',
    border: 'border-spot/45',
    glow: 'shadow-spot/10',
    meaning:
      'Zero-gamma level: dealer hedging flips from stabilizing (above) to destabilizing (below). Regime boundary.',
  },
}

// Maps canonical analytics level types to the chart's display labels + styles.
const TYPE_TO_LABEL: Record<string, string> = {
  attraction: 'Attraction',
  reversal: 'Reversal',
  continuation: 'Continuation',
  'buy-above': 'Buy Above',
  'sell-below': 'Sell Below',
  'gamma-flip': 'Gamma Flip',
}

const SIGNAL_VAR: Record<string, string> = {
  buy: '--bull',
  sell: '--bear',
  reversal: '--reversal',
  continuation: '--bull',
}

type Pill = {
  id: string
  price: number
  name: string
  style: LevelStyle
}

type TrailBand = {
  id: string
  price: number
  strength: number // 0..1
  kind: 'sticky' | 'slippery'
}

export function TvChart() {
  const {
    symbol,
    timeframe,
    simpleMode,
    nodesOn,
    showAttraction,
    showReversal,
    showContinuation,
    showSellZone,
    showTrails,
    autoUpdate,
    focusSignal,
  } = useFilters()

  // Dealer-positioning bands (sticky = positive gamma / support, slippery =
  // negative gamma) drawn behind the price action as horizontal dot trails.
  const { board } = useGexBoard(symbol, autoUpdate)

  // Everything the chart draws comes from the canonical analytics envelope.
  // No mock fallback: when live data is unavailable we render nothing rather
  // than presenting generated candles/levels as if they were real.
  const { envelope } = useInstrumentData()

  // SWR keeps previous data during a symbol switch. Only trust the envelope
  // when it actually belongs to the symbol currently selected — otherwise the
  // new ticker's candles could briefly render against the old ticker's price
  // levels (which is what made the numbers look wrong on switch).
  const payload =
    envelope?.data && envelope.data.symbol === symbol ? envelope.data : null
  const analytics = payload?.analytics
  const spotPrice = analytics?.spot ?? 0

  const candles = useMemo<Candle[]>(
    () => (payload?.candles ?? []) as Candle[],
    [payload],
  )

  // Canonical levels mapped to the chart's display labels.
  const displayLevels = useMemo(() => {
    if (!analytics) return [] as { label: string; price: number }[]
    // Sanity guard: a real gamma/reversal level is always within a modest band
    // of the current price. Anything wildly far from spot can only be stale
    // cross-ticker data (e.g. NVDA's ~200 levels leaking onto a ~696 QQQ chart
    // during a symbol switch), so drop it before it ever renders as a pill.
    const maxDistPct = 0.25
    return allLevels(analytics)
      .map((l) => {
        const label = TYPE_TO_LABEL[l.type]
        return label ? { label, price: l.price } : null
      })
      .filter((x): x is { label: string; price: number } => x != null)
      .filter(
        (x) =>
          !spotPrice ||
          Math.abs(x.price - spotPrice) / spotPrice <= maxDistPct,
      )
  }, [analytics, spotPrice])

  const levels = useMemo(
    () =>
      displayLevels.filter((l) => {
        if (!nodesOn) return false
        if (simpleMode && (l.label === 'Reversal' || l.label === 'Continuation')) {
          return false
        }
        if (l.label === 'Attraction') return showAttraction
        if (l.label === 'Reversal') return showReversal
        if (l.label === 'Continuation') return showContinuation
        if (l.label === 'Sell Below') return showSellZone
        return true
      }),
    [
      displayLevels,
      nodesOn,
      simpleMode,
      showAttraction,
      showReversal,
      showContinuation,
      showSellZone,
    ],
  )

  const focus =
    focusSignal && focusSignal.symbol === symbol ? focusSignal : null

  // Pills describe the labels we render as attached right-edge chips.
  const pills = useMemo<Pill[]>(() => {
    const out: Pill[] = levels
      .filter((l) => LEVEL_STYLE[l.label])
      .map((l) => ({
        // Key must be unique per level. Several levels share a label
        // (e.g. multiple "Reversal" nodes), so keying by label alone caused
        // React to keep stale pills mounted when the set shrank on a ticker
        // switch. Include the price to guarantee uniqueness.
        id: `${l.label}-${l.price}`,
        price: l.price,
        name: l.label,
        style: LEVEL_STYLE[l.label],
      }))
    if (focus) {
      out.push({
        id: `focus-${focus.price}`,
        price: focus.price,
        name: focus.type.toUpperCase(),
        style:
          LEVEL_STYLE[focus.type === 'sell' ? 'Sell Below' : 'Buy Above'] ??
          LEVEL_STYLE['Buy Above'],
      })
    }
    return out
  }, [levels, focus])

  // Horizontal gamma bands: the strikes with the most net GEX near spot,
  // colored sticky (positive gamma / dealers buy dips = support) or
  // slippery (negative gamma / dealers sell dips = fuel for a fast move).
  const trailBands = useMemo<TrailBand[]>(() => {
    if (!showTrails || !board || board.symbol !== symbol) return []
    const maxAbs = board.maxNetAbs || 1
    return board.rows
      .map((r) => ({
        id: `trail-${r.strike}`,
        price: r.strike,
        strength: Math.min(1, Math.abs(r.net) / maxAbs),
        kind: (r.net >= 0 ? 'sticky' : 'slippery') as 'sticky' | 'slippery',
      }))
      .filter((b) => b.strength >= 0.16)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6)
  }, [showTrails, board, symbol])

  const containerRef = useRef<HTMLDivElement>(null)
  const trailOverlayRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  // Active level prices the price scale must keep in view so no node pill clips.
  const levelPricesRef = useRef<number[]>([])
  // Tracks the symbol we have already auto-fit once, so refreshes don't reset
  // the user's chosen pan/zoom. null means "still owe this symbol a fit".
  const fittedSymbolRef = useRef<string | null>(null)
  const volSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: cssVar('--muted-foreground', '#9aa3ae'),
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: cssVarAlpha('--border-strong', 0.5, 'rgba(255,255,255,0.04)'), style: LineStyle.Dotted },
        horzLines: { color: cssVarAlpha('--border-strong', 0.5, 'rgba(255,255,255,0.04)'), style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelBackgroundColor: cssVar('--primary', '#4d7cff') },
        horzLine: { labelBackgroundColor: cssVar('--primary', '#4d7cff') },
      },
      rightPriceScale: {
        borderColor: cssVarAlpha('--border-strong', 1, 'rgba(255,255,255,0.1)'),
      },
      timeScale: {
        borderColor: cssVarAlpha('--border-strong', 1, 'rgba(255,255,255,0.1)'),
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: cssVar('--bull', '#3fd08a'),
      downColor: cssVar('--bear', '#f0625e'),
      wickUpColor: cssVar('--bull', '#3fd08a'),
      wickDownColor: cssVar('--bear', '#f0625e'),
      borderVisible: false,
      priceLineColor: cssVar('--spot', '#5a8cff'),
      // Expand the auto-scaled price range to include every active level so
      // all node pills (attraction, reversal, walls) stay on-screen.
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
        const res = original()
        const extras = levelPricesRef.current
        if (!res || !extras.length) return res
        const min = Math.min(res.priceRange.minValue, ...extras)
        const max = Math.max(res.priceRange.maxValue, ...extras)
        const pad = (max - min) * 0.04
        return {
          priceRange: { minValue: min - pad, maxValue: max + pad },
        }
      },
    })
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.26 },
    })

    const volSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    })
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volSeriesRef.current = volSeries
    markersRef.current = createSeriesMarkers(candleSeries, [])
    setHydrated(true)

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volSeriesRef.current = null
      markersRef.current = null
      priceLinesRef.current = []
    }
  }, [])

  // Push candle + volume data whenever candles change.
  useEffect(() => {
    const cs = candleSeriesRef.current
    const vs = volSeriesRef.current
    if (!cs || !vs || !candles.length) return

    const bull = cssVarAlpha('--bull', 0.4, 'rgba(63,208,138,0.4)')
    const bear = cssVarAlpha('--bear', 0.4, 'rgba(240,98,94,0.4)')

    const seen = new Set<number>()
    const sorted = [...candles]
      .filter((c) => Number.isFinite(c.epoch) && !seen.has(c.epoch) && seen.add(c.epoch))
      .sort((a, b) => a.epoch - b.epoch)

    cs.setData(
      sorted.map((c) => ({
        time: c.epoch as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )
    // Real traded volume only. If the feed doesn't provide volume we hide the
    // histogram rather than invent bar heights.
    const hasVolume = sorted.some((c) => typeof c.volume === 'number' && c.volume > 0)
    vs.setData(
      hasVolume
        ? sorted.map((c) => ({
            time: c.epoch as UTCTimestamp,
            value: c.volume ?? 0,
            color: c.close >= c.open ? bull : bear,
          }))
        : [],
    )

    // Only auto-fit the FIRST time a given symbol loads data. After that, leave
    // the time scale exactly where the user panned/zoomed it — periodic 30s
    // refreshes must not yank the view back.
    if (fittedSymbolRef.current !== symbol) {
      cs.priceScale().applyOptions({ autoScale: true })
      chartRef.current?.timeScale().fitContent()
      fittedSymbolRef.current = symbol
    }
  }, [candles, symbol])

  // When the symbol changes, mark that we still owe this symbol an initial fit.
  // The actual fitContent happens in the data effect once the new candles land,
  // so we never fit against the previous ticker's stale data.
  useEffect(() => {
    fittedSymbolRef.current = null
  }, [symbol])

  // Redraw thin horizontal guide lines (labels rendered as HTML pills instead).
  useEffect(() => {
    const cs = candleSeriesRef.current
    if (!cs || !candles.length) return

    // Keep the price scale aware of every active level + spot so pills never
    // clip. We only trigger a rescale on the initial fit for a symbol; on
    // periodic refreshes we update the reference values but leave the user's
    // current pan/zoom untouched.
    levelPricesRef.current = [
      spotPrice,
      ...levels.map((l) => l.price),
      ...(focus ? [focus.price] : []),
    ].filter((p) => Number.isFinite(p) && p > 0)
    if (fittedSymbolRef.current !== symbol) {
      cs.priceScale().applyOptions({ autoScale: true })
    }

    for (const pl of priceLinesRef.current) cs.removePriceLine(pl)
    priceLinesRef.current = []

    // Spot line keeps its native axis price label (the blue chip).
    priceLinesRef.current.push(
      cs.createPriceLine({
        price: spotPrice,
        color: cssVar('--spot', '#5a8cff'),
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'spot',
      }),
    )

    for (const l of levels) {
      const style = LEVEL_STYLE[l.label]
      if (!style) continue
      priceLinesRef.current.push(
        cs.createPriceLine({
          price: l.price,
          color: cssVar(style.varName, '#888'),
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        }),
      )
    }

    if (focus) {
      priceLinesRef.current.push(
        cs.createPriceLine({
          price: focus.price,
          color: cssVar(SIGNAL_VAR[focus.type] ?? '--spot', '#5a8cff'),
          lineWidth: 2,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: false,
          title: '',
        }),
      )
      const last = candles[candles.length - 1]
      markersRef.current?.setMarkers([
        {
          time: last.epoch as UTCTimestamp,
          position: focus.type === 'sell' ? 'aboveBar' : 'belowBar',
          color: cssVar(SIGNAL_VAR[focus.type] ?? '--spot', '#5a8cff'),
          shape: focus.type === 'sell' ? 'arrowDown' : 'arrowUp',
          text: `${focus.type.toUpperCase()} @ ${focus.price.toFixed(2)}`,
        },
      ])
    } else {
      markersRef.current?.setMarkers([])
    }
  }, [levels, focus, spotPrice, candles, symbol])

  // Position the HTML level pills at their price coordinate every frame, with
  // simple vertical de-collision so adjacent labels stay legible.
  useEffect(() => {
    if (!hydrated) return
    let raf = 0
    const GAP = 26
    const tick = () => {
      const cs = candleSeriesRef.current
      const overlay = overlayRef.current
      const trailOverlay = trailOverlayRef.current
      if (cs && trailOverlay && trailOverlay.children.length) {
        for (let i = 0; i < trailOverlay.children.length; i++) {
          const band = trailBands[i]
          const child = trailOverlay.children[i] as HTMLElement
          const y = band ? cs.priceToCoordinate(band.price) : null
          if (y == null) {
            child.style.display = 'none'
          } else {
            child.style.display = ''
            child.style.top = `${y}px`
          }
        }
      }
      if (cs && overlay && overlay.children.length) {
        const items: { idx: number; y: number }[] = []
        for (let i = 0; i < pills.length; i++) {
          const y = cs.priceToCoordinate(pills[i].price)
          if (y != null) items.push({ idx: i, y })
        }
        items.sort((a, b) => a.y - b.y)
        for (let k = 1; k < items.length; k++) {
          if (items[k].y - items[k - 1].y < GAP) {
            items[k].y = items[k - 1].y + GAP
          }
        }
        const yByIdx = new Map(items.map((it) => [it.idx, it.y]))
        for (let i = 0; i < overlay.children.length; i++) {
          const child = overlay.children[i] as HTMLElement
          const y = yByIdx.get(i)
          if (y == null) {
            child.style.display = 'none'
          } else {
            child.style.display = ''
            child.style.top = `${y}px`
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pills, trailBands, hydrated])

  return (
    <div className="relative h-full min-h-[420px] w-full">
      {/* header overlay */}
      <div className="pointer-events-none absolute left-3 top-2 z-10 space-y-0.5">
        <p className="font-mono text-xs font-medium text-foreground">
          {symbol} · {timeframe}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {simpleMode ? 'Simple Mode · key zones only' : 'Live candles · gamma levels'}
        </p>
      </div>

      <div ref={containerRef} className="h-full w-full" />

      {/* Gamma trail bands: sticky (support) vs slippery (fuel) price zones. */}
      <div ref={trailOverlayRef} className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
        {trailBands.map((b) => (
          <div
            key={b.id}
            className="absolute left-0 right-14 -translate-y-1/2"
            style={{ top: '-100px' }}
          >
            <div
              style={{
                height: `${3 + b.strength * 7}px`,
                backgroundImage: `radial-gradient(circle, ${trailColor(b.kind, b.strength)} 1.6px, transparent 1.8px)`,
                backgroundSize: '9px 100%',
                backgroundRepeat: 'repeat-x',
                backgroundPosition: 'center',
              }}
            />
            <span
              className={cn(
                'absolute left-1.5 top-1/2 -translate-y-1/2 rounded px-1 py-px font-mono text-[9px] font-semibold leading-none backdrop-blur-sm',
                b.kind === 'sticky' ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear',
              )}
            >
              {b.kind}
            </span>
          </div>
        ))}
      </div>

      {/* Right-edge level pills, attached to each price coordinate. */}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      >
        {pills.map((p) => {
          const Icon = p.style.Icon
          return (
            <div
              key={p.id}
              className="group/pill pointer-events-auto absolute right-[58px] -translate-y-1/2"
              style={{ top: '-100px' }}
            >
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full border bg-card/90 px-2 py-0.5 shadow-sm backdrop-blur-sm',
                  p.style.border,
                  p.style.glow,
                )}
              >
                <Icon className={cn('size-3', p.style.text)} />
                <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                  {p.price.toFixed(2)}
                </span>
                <span className={cn('text-[11px] font-semibold', p.style.text)}>
                  {p.name}
                </span>
              </div>
              {/* hover meaning popover */}
              <div className="pointer-events-none absolute right-full top-1/2 mr-2 hidden w-52 -translate-y-1/2 rounded-lg border border-border bg-popover p-2.5 text-[11px] leading-relaxed text-muted-foreground shadow-xl group-hover/pill:block">
                <span className={cn('font-semibold', p.style.text)}>
                  {p.name}
                </span>{' '}
                {p.style.meaning}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
