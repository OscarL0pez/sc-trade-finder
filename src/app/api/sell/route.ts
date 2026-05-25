import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const UEX_BASE = 'https://api.uexcorp.space/2.0'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') || '').toLowerCase().trim()
  const directId = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null

  if (!query || query.length < 2) {
    return NextResponse.json({ status: 'ok', data: [], commodities: [] })
  }

  // If direct ID provided, skip commodity search
  let commodity: { id: number; name: string; code: string } | null = null

  if (directId) {
    // Fetch prices directly by known id
    commodity = { id: directId, name: query, code: '' }
  } else {
    // Step 1: fetch all commodities and filter by name
    const commRes = await fetch(`${UEX_BASE}/commodities`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
      next: { revalidate: 86400 },
    })
    if (!commRes.ok) return NextResponse.json({ status: 'error', data: [] })
    const commJson = await commRes.json()
    const allComms: { id: number; name: string; code: string }[] = commJson.data || []

    const matches = allComms.filter((c) =>
      c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
    )

    if (matches.length === 0) return NextResponse.json({ status: 'ok', data: [], commodities: [] })

    // Multiple matches — return list for user to pick
    if (matches.length > 1) {
      return NextResponse.json({ status: 'ok', data: [], commodities: matches.slice(0, 12) })
    }

    commodity = matches[0]
  }

  // Fetch sell prices for this commodity
  const pricesRes = await fetch(
    `${UEX_BASE}/commodities_prices?id_commodity=${commodity.id}`,
    {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
      next: { revalidate: 1800 },
    }
  )
  if (!pricesRes.ok) return NextResponse.json({ status: 'error', data: [] })
  const pricesJson = await pricesRes.json()
  const prices: unknown[] = pricesJson.data || []

  // Terminals that BUY this commodity from the player (price_sell = what terminal pays)
  const buyers = prices.filter((p: unknown) => {
    const r = p as { price_sell: number; scu_sell: number }
    return r.price_sell > 0 && r.scu_sell > 0
  })

  // If commodity name was just the id placeholder, update from first result
  if (buyers.length > 0 && !directId) {
    const first = buyers[0] as { commodity_name?: string; commodity_code?: string }
    if (first.commodity_name) commodity = { ...commodity, name: first.commodity_name, code: first.commodity_code || '' }
  }

  return NextResponse.json(
    { status: 'ok', commodity, commodities: [], data: buyers },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
      },
    }
  )
}
