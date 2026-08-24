import { NextResponse } from "next/server"
import { fetchGexBoard } from "@/lib/uw/service"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "SPY"
  try {
    const board = await fetchGexBoard(symbol)
    return NextResponse.json(board)
  } catch (err) {
    console.log("[v0] gex-board route error:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to load GEX board" },
      { status: 500 },
    )
  }
}
