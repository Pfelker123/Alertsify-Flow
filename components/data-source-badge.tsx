'use client'

import { useEffect, useState } from 'react'
import { StatusBadge, type DataStatus } from '@/components/status-badge'
import type { DataMeta, DataSource } from '@/lib/market/types'
import { cn } from '@/lib/utils'

const SOURCE_TO_STATUS: Record<DataSource, DataStatus> = {
  live: 'live',
  delayed: 'partial',
  stale: 'stale',
  demo: 'demo',
  unavailable: 'error',
}

const SOURCE_LABEL: Record<DataSource, string> = {
  live: 'Live',
  delayed: 'Delayed',
  stale: 'Stale',
  demo: 'Demo data',
  unavailable: 'Unavailable',
}

function ageLabel(fetchedAt: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

/**
 * Canonical provenance badge. Shows LIVE / DELAYED / STALE / DEMO / UNAVAILABLE
 * from a DataEnvelope's meta plus a live-updating "x ago" freshness label. This
 * is the single source of truth for how data provenance is communicated, so no
 * surface can silently present generated values as live.
 */
export function DataSourceBadge({
  meta,
  showAge = true,
  className,
}: {
  meta: Pick<DataMeta, 'source' | 'fetchedAt' | 'error'> | undefined
  showAge?: boolean
  className?: string
}) {
  // Re-render every second so the freshness label stays honest.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!showAge) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [showAge])

  if (!meta) {
    return <StatusBadge status="partial" label="Loading" pulse={false} className={className} />
  }

  const status = SOURCE_TO_STATUS[meta.source]
  const label = SOURCE_LABEL[meta.source]

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      title={meta.error ?? undefined}
    >
      <StatusBadge status={status} label={label} />
      {showAge && meta.source !== 'unavailable' && meta.source !== 'demo' && (
        <span className="font-mono text-[10px] text-text-muted">
          {ageLabel(meta.fetchedAt)}
        </span>
      )}
    </span>
  )
}
