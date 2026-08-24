import { NextResponse } from "next/server"
import { fetchCandles } from "@/lib/uw/service"
import type { Timeframe } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID: Timeframe[] = [
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "daily",
  "weekly",
]

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  const tf = new URL(req.url).searchParams.get("tf") as Timeframe | null
  const timeframe = tf && VALID.includes(tf) ? tf : "5m"
  try {
    const candles = await fetchCandles(symbol, timeframe)
    return NextResponse.json({ candles })
  } catch (err) {
    console.log("[v0] candles route error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load candles" }, { status: 500 })
  }
}
