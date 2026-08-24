import { NextResponse } from "next/server"
import { fetchOptionsFlowPrints } from "@/lib/uw/service"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 150
  try {
    const { prints, live } = await fetchOptionsFlowPrints(limit)
    return NextResponse.json({ prints, live })
  } catch (err) {
    console.log("[v0] flow route error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load options flow" }, { status: 500 })
  }
}
