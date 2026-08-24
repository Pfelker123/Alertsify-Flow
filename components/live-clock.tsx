'use client'

import { useEffect, useState } from 'react'

function format(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function LiveClock({ prefix }: { prefix?: string }) {
  // Start null to avoid SSR/CSR hydration mismatch, then tick client-side.
  const [now, setNow] = useState<string | null>(null)

  useEffect(() => {
    setNow(format(new Date()))
    const id = setInterval(() => setNow(format(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="tabular-nums">
      {prefix}
      {now ?? '--:--:-- --'}
    </span>
  )
}
