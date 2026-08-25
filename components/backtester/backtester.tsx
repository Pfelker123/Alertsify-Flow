'use client'

import { useState } from 'react'
import { FlaskConical, Info, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Strategy builder option sets ---
const UNIVERSES = ['SPY', 'QQQ', 'IWM', 'Mag 7', 'S&P 100', 'Custom list']
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', 'Daily']
const ENTRY_TRIGGERS = [
  'Touch of level',
  'Break & retest',
  'Rejection wick',
  'Flow confirmation',
]
const LEVEL_TYPES = [
  'Attraction',
  'Reversal',
  'Continuation',
  'Call wall',
  'Put wall',
  'Gamma flip',
]
const REGIMES = ['Any', 'Positive gamma', 'Negative gamma']
const EXIT_METHODS = ['Next level', 'Fixed R multiple', 'Time-based', 'Trailing stop']
const STOP_METHODS = ['Structure', 'ATR', 'Fixed %', 'Opposing level']

// Validation lifecycle — only the earliest stage is ever active for a
// prototype. Nothing here implies a strategy has been validated.
const VALIDATION_STAGES = [
  { id: 'prototype', label: 'Prototype logic' },
  { id: 'in-sample', label: 'In-sample' },
  { id: 'walk-forward', label: 'Walk-forward' },
  { id: 'out-of-sample', label: 'Out-of-sample' },
  { id: 'paper', label: 'Paper-traded' },
  { id: 'production', label: 'Production monitored' },
]

const METRICS = [
  'Total trades',
  'Win rate',
  'Avg win / loss',
  'Expectancy',
  'Profit factor',
  'Max drawdown',
  'Sharpe',
  'Sortino',
  'Avg hold time',
]

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function Backtester() {
  const [universe, setUniverse] = useState(UNIVERSES[0])
  const [from, setFrom] = useState('2024-01-01')
  const [to, setTo] = useState('2024-12-31')
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[1])
  const [entry, setEntry] = useState(ENTRY_TRIGGERS[0])
  const [levelType, setLevelType] = useState(LEVEL_TYPES[0])
  const [minConfidence, setMinConfidence] = useState(60)
  const [regime, setRegime] = useState(REGIMES[0])
  const [flowConfirm, setFlowConfirm] = useState(true)
  const [exit, setExit] = useState(EXIT_METHODS[0])
  const [stop, setStop] = useState(STOP_METHODS[0])
  const [costs, setCosts] = useState(0.65)
  const [slippage, setSlippage] = useState(2)
  const [attempted, setAttempted] = useState(false)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* Strategy builder */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Strategy builder</h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Universe">
            <Select value={universe} onChange={setUniverse} options={UNIVERSES} />
          </Field>
          <Field label="Timeframe">
            <Select value={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />
          </Field>
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label="Entry trigger">
            <Select value={entry} onChange={setEntry} options={ENTRY_TRIGGERS} />
          </Field>
          <Field label="Level type">
            <Select value={levelType} onChange={setLevelType} options={LEVEL_TYPES} />
          </Field>
          <Field label="Gamma regime">
            <Select value={regime} onChange={setRegime} options={REGIMES} />
          </Field>
          <Field label="Exit method">
            <Select value={exit} onChange={setExit} options={EXIT_METHODS} />
          </Field>
          <Field label="Stop method">
            <Select value={stop} onChange={setStop} options={STOP_METHODS} />
          </Field>
          <Field label="Min confidence">
            <div className="flex h-9 items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="flex-1 accent-[var(--brand-blue)]"
              />
              <span className="w-9 text-right font-mono text-xs tabular-nums text-foreground">
                {minConfidence}%
              </span>
            </div>
          </Field>
          <Field label="Commission ($/contract)">
            <input
              type="number"
              step="0.01"
              value={costs}
              onChange={(e) => setCosts(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label="Slippage (ticks)">
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-secondary px-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={flowConfirm}
            onChange={(e) => setFlowConfirm(e.target.checked)}
            className="size-4 accent-[var(--brand-blue)]"
          />
          Require options-flow confirmation
        </label>

        <button
          onClick={() => setAttempted(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Play className="size-4" />
          Run backtest
        </button>
      </section>

      {/* Results */}
      <section className="flex flex-col gap-4">
        {/* Validation lifecycle */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Validation stage</h2>
            <span className="rounded-full bg-attraction/15 px-2 py-0.5 text-[11px] font-medium text-attraction">
              Prototype logic
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VALIDATION_STAGES.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  i === 0
                    ? 'border-attraction/40 bg-attraction/10 text-attraction'
                    : 'border-border bg-secondary/50 text-text-muted',
                )}
              >
                {s.label}
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
            This configuration is unvalidated prototype logic. Results appear only
            after a real backtest engine returns a verified payload — no
            performance numbers are simulated or implied here.
          </p>
        </div>

        {/* Metrics grid — honest empty state */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Results</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {METRICS.map((m) => (
              <div
                key={m}
                className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {m}
                </span>
                <span className="font-mono text-lg font-semibold tabular-nums text-text-muted">
                  —
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-border bg-background/40 px-6 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FlaskConical className="size-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold">
              {attempted ? 'Backtest engine not connected' : 'No backtest has been run'}
            </h3>
            <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
              {attempted
                ? 'Your strategy definition is captured, but this prototype has no historical execution engine wired in yet. Rather than show invented performance, Alertsify Flow leaves these metrics empty until a verified result payload is available.'
                : 'Define a strategy on the left and run it. Equity curve, drawdown, and the trade table will populate here only from a real result payload.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
