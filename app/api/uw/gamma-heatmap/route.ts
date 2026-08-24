import { NextResponse } from "next/server"
import { fetchGammaHeatmapForUW } from "@/lib/uw/service"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID_STRIKE_COUNTS = new Set([30, 50, 100, 150])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get("symbol") ?? "SPY"
  const strikesParam = Number(url.searchParams.get("strikes"))
  const strikeCount = VALID_STRIKE_COUNTS.has(strikesParam) ? strikesParam : 50
  try {
    const board = await fetchGammaHeatmapForUW(symbol, strikeCount)
    return NextResponse.json(board)
  } catch (err) {
    console.log("[v0] gamma-heatmap route error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load gamma heat map" }, { status: 500 })
  }
}
