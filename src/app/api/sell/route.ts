import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const UEX_BASE = 'https://api.uexcorp.space/2.0'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const listOnly = searchParams.get('list') === '1'
  const query    = (searchParams.get('q') || '').toLowerCase().trim()
  const directId = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null
  const directName = searchParams.get('name') || ''

  // ── Mode 1: return full commodity list ──────────────────────────────────────
  if (listOnly) {
    const res = await fetch(`${UEX_BASE}/commodities`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return NextResponse.json({ status: 'error', data: [] })
    const json = await res.json()
    return NextResponse.json(
      { status: 'ok', data: (json.data || []).map((c: { id: number; name: string; code: string }) => ({ id: c.id, name: c.name, code: c.code })) },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } }
    )
  }

  // ── Mode 2: fetch sell prices by commodity id ────────────────────────────────
  if (directId) {
    const pricesRes = await fetch(
      `${UEX_BASE}/commodities_prices?id_commodity=${directId}`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
        next: { revalidate: 1800 },
      }
    )
    if (!pricesRes.ok) return NextResponse.json({ status: 'error', data: [] })
    const pricesJson = await pricesRes.json()
    const prices: unknown[] = pricesJson.data || []
    const buyers = prices.filter((p: unknown) => {
      const r = p as { price_sell: number; scu_sell: number }
      return r.price_sell > 0 && r.scu_sell > 0
    })
    return NextResponse.json(
      { status: 'ok', commodity: { id: directId, name: directName, code: '' }, commodities: [], data: buyers },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=1800' } }
    )
  }

  // ── Mode 3: legacy text search (fallback) ────────────────────────────────────
  if (!query || query.length < 2) {
    return NextResponse.json({ status: 'ok', data: [], commodities: [] })
  }
  const commRes = await fetch(`${UEX_BASE}/commodities`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
    next: { revalidate: 86400 },
  })
  if (!commRes.ok) return NextResponse.json({ status: 'error', data: [] })
  const commJson = await commRes.json()
  const allComms: { id: number; name: string; code: string }[] = commJson.data || []
  const matches = allComms.filter(c =>
    c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
  )
  if (matches.length === 0) return NextResponse.json({ status: 'ok', data: [], commodities: [] })
  if (matches.length > 1)   return NextResponse.json({ status: 'ok', data: [], commodities: matches.slice(0, 12) })

  const commodity = matches[0]
  const pricesRes = await fetch(`${UEX_BASE}/commodities_prices?id_commodity=${commodity.id}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
    next: { revalidate: 1800 },
  })
  if (!pricesRes.ok) return NextResponse.json({ status: 'error', data: [] })
  const pricesJson = await pricesRes.json()
  const buyers = (pricesJson.data || []).filter((p: { price_sell: number; scu_sell: number }) =>
    p.price_sell > 0 && p.scu_sell > 0
  )
  return NextResponse.json(
    { status: 'ok', commodity, commodities: [], data: buyers },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=1800' } }
  )
}
