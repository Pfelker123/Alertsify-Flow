import { NextResponse } from "next/server"
import { fetchInstrument } from "@/lib/uw/service"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params
  try {
    const data = await fetchInstrument(symbol)
    return NextResponse.json(data)
  } catch (err) {
    console.log("[v0] symbol route error:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to load instrument data" },
      { status: 500 },
    )
  }
}
