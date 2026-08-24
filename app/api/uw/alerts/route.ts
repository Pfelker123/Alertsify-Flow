import { NextResponse } from "next/server"
import { fetchAlerts } from "@/lib/uw/service"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get("symbol") ?? undefined
  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 40
  try {
    const alerts = await fetchAlerts(symbol, limit)
    return NextResponse.json({ alerts })
  } catch (err) {
    console.log("[v0] alerts route error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load alerts" }, { status: 500 })
  }
}
