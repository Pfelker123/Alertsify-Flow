import { NextResponse } from "next/server"
import { fetchQuotes } from "@/lib/uw/service"
import { TAPE_SYMBOLS } from "@/lib/mock-data"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get("symbols")
  const symbols = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : TAPE_SYMBOLS
  try {
    const quotes = await fetchQuotes(symbols)
    return NextResponse.json({ quotes })
  } catch (err) {
    console.log("[v0] quotes route error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 })
  }
}
