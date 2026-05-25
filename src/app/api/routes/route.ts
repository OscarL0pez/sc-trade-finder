import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const UEX_BASE = 'https://api.uexcorp.space/2.0'

// Orbit IDs for available planets/locations per system
const ORBIT_IDS: Record<string, number[]> = {
  stanton: [116, 4, 59, 190],      // Hurston, ArcCorp, Crusader, MicroTech
  pyro:    [240, 241, 242, 243, 244, 245], // Pyro I-VI
  nyx:     [325],                   // Delamar
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const investment = searchParams.get('investment') || '500000'
  const system     = (searchParams.get('system') || 'stanton').toLowerCase()

  const orbitIds = ORBIT_IDS[system] || ORBIT_IDS.stanton

  // Fetch all orbits in parallel
  const results = await Promise.allSettled(
    orbitIds.map(id =>
      fetch(`${UEX_BASE}/commodities_routes?id_orbit_origin=${id}&investment=${investment}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SC-Trade-Finder/1.0' },
        next: { revalidate: 1800 },
      })
    )
  )

  // Merge results, deduplicate by route id
  const seen = new Set<number>()
  const merged: unknown[] = []

  for (const result of results) {
    if (result.status === 'rejected') continue
    const res = result.value
    if (!res.ok) continue
    const json = await res.json()
    if (!json.data) continue
    for (const route of json.data) {
      if (!seen.has(route.id)) {
        seen.add(route.id)
        merged.push(route)
      }
    }
  }

  return NextResponse.json(
    { status: 'ok', data: merged },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
      },
    }
  )
}
