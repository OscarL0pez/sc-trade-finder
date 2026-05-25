'use client'

import { useState, useEffect, useCallback } from 'react'

const SHIPS = [
  { label: 'C1 Spirit (64 SCU)',       scu: 64  },
  { label: 'Freelancer (32 SCU)',       scu: 32  },
  { label: 'RAFT (96 SCU)',             scu: 96  },
  { label: 'RAFT full (192 SCU)',       scu: 192 },
  { label: 'Freelancer MAX (128 SCU)',  scu: 128 },
  { label: 'Hull B (512 SCU)',          scu: 512 },
  { label: 'C2 Hercules (696 SCU)',     scu: 696 },
]

// Terminal accessibility filter
// Whitelist de estaciones orbitales — solo estas flotan en el espacio sin aterrizar
const ORBITAL_STATIONS = [
  // Stanton
  'everus harbor',      // Hurston L1
  'hdms-pinehaven',     // Hurston L2 — excepción, es accesible en órbita
  'baijini point',      // ArcCorp L1
  'lyria',              // ArcCorp L2
  'wala',               // ArcCorp L3
  'porto olisar',       // Crusader (legacy)
  'port olisar',        // Crusader (legacy)
  'port tressler',      // MicroTech L1
  'clio',               // MicroTech L2
  'euterpe',            // MicroTech L3
  'seraphim',           // Crusader L1
  'magnus gateway',     // Magnus
  'nyx gateway',        // Nyx
  'rest stop',          // generic rest stops
  'truck stop',
  'jump town',
  // Pyro
  'ruin station',
  'orbituary',
  'checkmate',
  'pyro gateway',
  'stanton gateway',
  'bloodeagles',
  'bloodshot',
]

function isOrbitalStation(terminalName: string): boolean {
  if (!terminalName) return false
  const n = terminalName.toLowerCase()
  return ORBITAL_STATIONS.some(k => n.includes(k))
}

// Acceso fácil legacy (mantiene compatibilidad con filtro anterior)
function isEasyAccess(terminalName: string): boolean {
  return isOrbitalStation(terminalName)
}

type Route = {
  id: number
  code: string
  commodity_name: string
  origin_terminal_name: string
  destination_terminal_name: string
  origin_star_system_name: string
  destination_star_system_name: string
  price_origin: number
  price_destination: number
  price_roi: number
  price_margin: number
  profit: number
  investment: number
  scu_origin: number
  scu_destination: number
  volatility_origin: number
  volatility_destination: number
  distance: number
  score: number
  date_added: number
}

type SortKey = 'profit' | 'roi' | 'investment' | 'ppu' | 'apm' | 'apgm'

// QT speed ~333 Mm/s = 0.333 Gm/s
// + ~3 min overhead (spooling, deceleration, docking)
const QT_SPEED_GM_PER_MIN = 0.333 * 60 // 20 Gm/min
const OVERHEAD_MIN = 4 // avg overhead per trip

function tripMinutes(distanceGm: number): number {
  if (!distanceGm || distanceGm <= 0) return OVERHEAD_MIN
  return (distanceGm / QT_SPEED_GM_PER_MIN) + OVERHEAD_MIN
}

function fmt(n: number) {
  if (!n || isNaN(n)) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

function fmtTime(min: number): string {
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  return `${(min / 60).toFixed(1)}h`
}

function getProfit(r: Route, scu: number): number {
  if (r.profit) return r.profit
  const ppu = (r.price_destination || 0) - (r.price_origin || 0)
  const usable = Math.min(scu, r.scu_origin || scu)
  return usable * ppu
}

function getApm(r: Route, scu: number): number {
  const profit = getProfit(r, scu)
  const mins = tripMinutes(r.distance)
  return profit / mins
}

function getFallback(scu: number): Route[] {
  return [
    { id:1, code:'fb1', commodity_name:'Carbon',         origin_terminal_name:'Orbituary',      destination_terminal_name:'Seraphim',     origin_star_system_name:'Pyro',    destination_star_system_name:'Stanton', price_origin:235,  price_destination:380,  price_roi:62, price_margin:145, profit:scu*145, investment:scu*235,  scu_origin:24000, scu_destination:24000, volatility_origin:0.05, volatility_destination:0.08, distance:94,  score:90, date_added:0 },
    { id:2, code:'fb2', commodity_name:'Helium',          origin_terminal_name:'Ruin Station',   destination_terminal_name:'Nyx Gateway',  origin_star_system_name:'Pyro',    destination_star_system_name:'Pyro',   price_origin:727,  price_destination:1200, price_roi:65, price_margin:473, profit:scu*473, investment:scu*727,  scu_origin:18800, scu_destination:18800, volatility_origin:0.12, volatility_destination:0.15, distance:130, score:85, date_added:0 },
    { id:3, code:'fb3', commodity_name:'Potassium',       origin_terminal_name:'Orbituary',      destination_terminal_name:'Nyx Gateway',  origin_star_system_name:'Pyro',    destination_star_system_name:'Pyro',   price_origin:396,  price_destination:560,  price_roi:41, price_margin:164, profit:scu*164, investment:scu*396,  scu_origin:24000, scu_destination:24000, volatility_origin:0.08, volatility_destination:0.10, distance:92,  score:75, date_added:0 },
    { id:4, code:'fb4', commodity_name:'Copper',          origin_terminal_name:'Orbituary',      destination_terminal_name:'Baijini Point',origin_star_system_name:'Pyro',    destination_star_system_name:'Stanton',price_origin:2893, price_destination:3700, price_roi:28, price_margin:807, profit:scu*807, investment:scu*2893, scu_origin:1000,  scu_destination:1000,  volatility_origin:0.20, volatility_destination:0.18, distance:77,  score:70, date_added:0 },
    { id:5, code:'fb5', commodity_name:'Iron',            origin_terminal_name:'Everus Harbor',  destination_terminal_name:"Rod's Fuel",   origin_star_system_name:'Stanton', destination_star_system_name:'Stanton',price_origin:2760, price_destination:3600, price_roi:30, price_margin:840, profit:scu*840, investment:scu*2760, scu_origin:364,   scu_destination:364,   volatility_origin:0.10, volatility_destination:0.12, distance:82,  score:65, date_added:0 },
    { id:6, code:'fb6', commodity_name:'Titanium',        origin_terminal_name:'HDMS-Lathan',    destination_terminal_name:'TDD Area 18',  origin_star_system_name:'Stanton', destination_star_system_name:'Stanton',price_origin:7034, price_destination:8300, price_roi:18, price_margin:1266,profit:scu*1266,investment:scu*7034, scu_origin:8000,  scu_destination:8000,  volatility_origin:0.06, volatility_destination:0.09, distance:23,  score:55, date_added:0 },
    { id:7, code:'fb7', commodity_name:'Pressurized Ice', origin_terminal_name:'Ruin Station',   destination_terminal_name:'Baijini Point',origin_star_system_name:'Pyro',    destination_star_system_name:'Stanton',price_origin:4756, price_destination:6000, price_roi:26, price_margin:1244,profit:scu*1244,investment:scu*4756, scu_origin:2000,  scu_destination:2000,  volatility_origin:0.15, volatility_destination:0.20, distance:99,  score:50, date_added:0 },
    { id:8, code:'fb8', commodity_name:'Silicon',         origin_terminal_name:'Ruin Station',   destination_terminal_name:'Seraphim',     origin_star_system_name:'Pyro',    destination_star_system_name:'Stanton',price_origin:1881, price_destination:2400, price_roi:28, price_margin:519, profit:scu*519, investment:scu*1881, scu_origin:827,   scu_destination:827,   volatility_origin:0.11, volatility_destination:0.13, distance:116, score:45, date_added:0 },
  ]
}

export default function Page() {
  const [shipIdx,     setShipIdx]     = useState(0)
  const [capital,     setCapital]     = useState(500000)
  const [system,      setSystem]      = useState('all')
  const [minRoi,      setMinRoi]      = useState(20)
  const [minFill,     setMinFill]     = useState(0)      // min % of ship to fill
  const [easyOnly,    setEasyOnly]    = useState(false)   // only space stations / rest stops
  const [limit,       setLimit]       = useState(10)
  const [sortKey,     setSortKey]     = useState<SortKey>('apm')
  const [routes,      setRoutes]      = useState<Route[]>([])
  const [status,      setStatus]      = useState<'idle'|'loading'|'ok'|'error'>('idle')
  const [statusMsg,   setStatusMsg]   = useState('Listo — pulsa buscar para consultar UEX')
  const [warning,     setWarning]     = useState('')
  const [isFallback,  setIsFallback]  = useState(false)
  const [dataTimestamp, setDataTimestamp] = useState<number|null>(null)
  const [dataAge,       setDataAge]       = useState('')

  const scu = SHIPS[shipIdx].scu

  const fetchRoutes = useCallback(async () => {
    setStatus('loading')
    setStatusMsg('Consultando UEX Corp API...')
    setWarning('')
    setIsFallback(false)

    try {
      const systems = system === 'all' ? ['stanton', 'pyro'] : [system]
      const responses = await Promise.allSettled(
        systems.map(s => fetch(`/api/routes?investment=${capital}&system=${s}`))
      )
      const seen = new Set<number>()
      let data: Route[] = []
      for (const result of responses) {
        if (result.status === 'rejected') continue
        const res = result.value
        if (!res.ok) continue
        const j = await res.json()
        if (j.error || !j.data) continue
        for (const r of j.data) {
          if (!seen.has(r.id)) { seen.add(r.id); data.push(r) }
        }
      }

      // filters
      data = data.filter(r => {
        const roi = r.price_roi || 0
        const inv = r.investment || 0
        const stockPct = ((r.scu_origin || 0) / scu) * 100
        const accessOk = !easyOnly || (isEasyAccess(r.origin_terminal_name) && isEasyAccess(r.destination_terminal_name))
        return roi >= minRoi && inv <= capital && stockPct >= minFill && accessOk
      })

      setRoutes(data)
      const maxTs = data.reduce((mx: number, r: Route) => r.date_added > mx ? r.date_added : mx, 0)
      if (maxTs > 0) setDataTimestamp(maxTs)
      setStatus('ok')
      setStatusMsg(`${data.length} rutas encontradas — datos en tiempo real de UEX`)
    } catch (e) {
      console.error(e)
      const fallback = getFallback(scu).filter(r => {
        const stockPct = ((r.scu_origin || 0) / scu) * 100
        const accessOk = !easyOnly || (isEasyAccess(r.origin_terminal_name) && isEasyAccess(r.destination_terminal_name))
        return (r.price_roi||0) >= minRoi && (r.investment||0) <= capital && stockPct >= minFill && accessOk &&
          (system==='all' || r.origin_star_system_name.toLowerCase()===system)
      })
      setRoutes(fallback)
      const maxTsFb = fallback.reduce((mx: number, r: Route) => r.date_added > mx ? r.date_added : mx, 0)
      if (maxTsFb > 0) setDataTimestamp(maxTsFb)
      setStatus('error')
      setIsFallback(true)
      setStatusMsg('Error conectando con UEX — mostrando datos en caché')
      setWarning('No se pudo conectar a UEX. Datos del último scrape conocido.')
    }
  }, [scu, capital, system, minRoi, minFill, easyOnly])

  useEffect(() => { fetchRoutes() }, [])

  // Countdown timer — UEX updates every 60 min
  useEffect(() => {
    const tick = () => {
      if (!dataTimestamp) { setDataAge('—'); return }
      const ageSeconds = Math.floor(Date.now() / 1000 - dataTimestamp)
      const h = Math.floor(ageSeconds / 3600)
      const m = Math.floor((ageSeconds % 3600) / 60)
      const s = ageSeconds % 60
      if (h > 0) {
        setDataAge(`Datos de hace ${h}h ${m}m`)
      } else if (m > 0) {
        setDataAge(`Datos de hace ${m}m ${s}s`)
      } else {
        setDataAge(`Datos de hace ${s}s`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dataTimestamp])

  const sorted = [...routes].sort((a, b) => {
    if (sortKey === 'profit')     return getProfit(b, scu) - getProfit(a, scu)
    if (sortKey === 'roi')        return (b.price_roi||0) - (a.price_roi||0)
    if (sortKey === 'investment') return (a.investment||0) - (b.investment||0)
    if (sortKey === 'ppu')        return ((b.price_destination-b.price_origin)||0) - ((a.price_destination-a.price_origin)||0)
    if (sortKey === 'apm')        return getApm(b, scu) - getApm(a, scu)
    if (sortKey === 'apgm')       return (getProfit(b,scu)/(b.distance||1)) - (getProfit(a,scu)/(a.distance||1))
    return 0
  }).slice(0, limit)

  const volColor = (v: number) => v > 0.25 ? 'r' : v > 0.12 ? 'y' : 'g'
  const volLabel = (v: number) => v > 0.25 ? 'ALTA ⚠️' : v > 0.12 ? 'MEDIA' : 'BAJA ✓'

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#040810;color:#c8d8f0;font-family:'Exo 2',sans-serif;min-height:100vh}
        body::before{content:'';position:fixed;inset:0;background-image:radial-gradient(1px 1px at 20% 30%,rgba(0,212,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 80% 10%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 50% 60%,rgba(0,255,136,.3) 0%,transparent 100%),radial-gradient(2px 2px at 45% 45%,rgba(0,212,255,.2) 0%,transparent 100%);pointer-events:none;z-index:0}
        .wrap{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:20px 16px 40px}
        header{display:flex;align-items:center;gap:16px;padding:24px 0 28px;border-bottom:1px solid #1a3a6e;margin-bottom:28px}
        .logo{width:52px;height:52px;background:linear-gradient(135deg,#00d4ff22,#00d4ff44);border:1px solid #00d4ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 0 20px rgba(0,212,255,.3);flex-shrink:0}
        h1{font-family:'Orbitron',monospace;font-size:1.35rem;font-weight:800;letter-spacing:.1em;color:#00d4ff;text-shadow:0 0 20px rgba(0,212,255,.5);line-height:1.2}
        h1 span{display:block;font-size:.62rem;color:#7a9cc0;letter-spacing:.25em;font-weight:400;margin-top:2px}
        .badge{margin-left:auto;background:#0d1f3c;border:1px solid #1a3a6e;padding:4px 10px;border-radius:4px;font-family:'Share Tech Mono',monospace;font-size:.7rem;color:#7a9cc0;white-space:nowrap}
        .filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;background:#0a1428;border:1px solid #1a3a6e;border-radius:10px;padding:18px;margin-bottom:16px}
        .fg{display:flex;flex-direction:column;gap:6px}
        label{font-family:'Share Tech Mono',monospace;font-size:.62rem;color:#7a9cc0;letter-spacing:.15em;text-transform:uppercase}
        select,input{background:#070d1a;border:1px solid #1a3a6e;color:#c8d8f0;padding:8px 10px;border-radius:6px;font-family:'Share Tech Mono',monospace;font-size:.8rem;outline:none;transition:border-color .2s;width:100%}
        select:focus,input:focus{border-color:#00d4ff;box-shadow:0 0 0 2px rgba(0,212,255,.15)}
        select option{background:#0a1428}
        .btn{background:linear-gradient(135deg,#00d4ff22,#00d4ff44);border:1px solid #00d4ff;color:#00d4ff;padding:10px 16px;border-radius:6px;font-family:'Orbitron',monospace;font-size:.7rem;font-weight:600;letter-spacing:.1em;cursor:pointer;transition:all .2s;box-shadow:0 0 20px rgba(0,212,255,.3);align-self:flex-end;width:100%}
        .btn:hover:not(:disabled){background:linear-gradient(135deg,#00d4ff44,#00d4ff66);box-shadow:0 0 30px rgba(0,212,255,.5);transform:translateY(-1px)}
        .btn:disabled{opacity:.4;cursor:not-allowed}
        .status{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0a1428;border:1px solid #1a3a6e;border-radius:8px;margin-bottom:12px;font-family:'Share Tech Mono',monospace;font-size:.73rem;color:#7a9cc0;min-height:42px}
        .dot{width:8px;height:8px;border-radius:50%;background:#7a9cc0;flex-shrink:0;transition:background .3s}
        .dot.loading{background:#ffd700;animation:pulse 1s infinite}
        .dot.ok{background:#00ff88}
        .dot.error{background:#ff3a3a}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .warn{background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.4);border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:.78rem;color:#ffaa44;display:flex;gap:10px;align-items:flex-start}
        .fallback-note{background:rgba(255,107,0,.08);border:1px solid rgba(255,107,0,.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:.73rem;color:#ff9940;font-family:'Share Tech Mono',monospace}
        .tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .tab{background:#0a1428;border:1px solid #1a3a6e;color:#7a9cc0;padding:6px 14px;border-radius:20px;font-family:'Share Tech Mono',monospace;font-size:.68rem;cursor:pointer;transition:all .2s;letter-spacing:.05em}
        .tab:hover{border-color:#00d4ff;color:#00d4ff}
        .tab.active{background:rgba(0,212,255,.15);border-color:#00d4ff;color:#00d4ff;box-shadow:0 0 10px rgba(0,212,255,.2)}
        .tab.highlight{border-color:rgba(0,255,136,.5);color:#00ff88}
        .tab.highlight.active{background:rgba(0,255,136,.15);border-color:#00ff88;box-shadow:0 0 10px rgba(0,255,136,.2)}
        .cards{display:flex;flex-direction:column;gap:10px}
        .card{background:#0a1428;border:1px solid #1a3a6e;border-radius:10px;padding:16px 18px;transition:border-color .2s,box-shadow .2s,transform .15s;position:relative;overflow:hidden;animation:fadeIn .3s ease forwards;opacity:0}
        .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--ac,#00d4ff),transparent)}
        .card:hover{border-color:#00d4ff;box-shadow:0 0 20px rgba(0,212,255,.3);transform:translateY(-2px)}
        .card.r1{--ac:#ffd700;border-color:rgba(255,215,0,.25)}
        .card.r2{--ac:#c0c0c0}
        .card.r3{--ac:#cd7f32}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .ch{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}
        .rk{font-size:1.1rem;flex-shrink:0;width:26px;text-align:center}
        .cn{font-family:'Orbitron',monospace;font-size:.88rem;font-weight:600;flex:1;line-height:1.4}
        .pb{font-family:'Orbitron',monospace;font-size:1rem;font-weight:800;color:#00ff88;text-shadow:0 0 10px rgba(0,255,136,.4);white-space:nowrap}
        .path{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
        .loc{background:#070d1a;border:1px solid #1a3a6e;padding:5px 10px;border-radius:5px;font-family:'Share Tech Mono',monospace;font-size:.7rem}
        .loc.buy{border-color:rgba(255,107,0,.5);color:#ff9940}
        .loc.sell{border-color:rgba(0,255,136,.5);color:#00ff88}
        .loc small{display:block;color:#7a9cc0;font-size:.6rem}
        .arr{color:#7a9cc0}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px}
        .st{background:#070d1a;border:1px solid #1a3a6e;border-radius:6px;padding:7px 10px}
        .st.highlight{border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.05)}
        .sl{font-family:'Share Tech Mono',monospace;font-size:.58rem;color:#7a9cc0;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
        .sv{font-family:'Share Tech Mono',monospace;font-size:.8rem;font-weight:bold}
        .sv.g{color:#00ff88}.sv.y{color:#ffd700}.sv.r{color:#ff3a3a}
        .uex-link{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-family:'Share Tech Mono',monospace;font-size:.62rem;color:#7a9cc0;text-decoration:none;padding:4px 8px;border:1px solid #1a3a6e;border-radius:4px;transition:all .2s}
        .uex-link:hover{color:#00d4ff;border-color:#00d4ff}
        .fill-bar{height:4px;background:#1a3a6e;border-radius:2px;margin-top:4px;overflow:hidden}
        .fill-bar-inner{height:100%;border-radius:2px;transition:width .3s}
        .empty{text-align:center;padding:60px 20px;color:#7a9cc0;font-family:'Share Tech Mono',monospace;font-size:.83rem}
        .empty .ei{font-size:3rem;margin-bottom:16px;opacity:.5}
        footer{margin-top:32px;padding-top:16px;border-top:1px solid #1a3a6e;text-align:center;font-size:.68rem;color:#7a9cc0;font-family:'Share Tech Mono',monospace}
        footer a{color:#00d4ff;text-decoration:none}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#040810}
        ::-webkit-scrollbar-thumb{background:#1a3a6e;border-radius:3px}
        @media(max-width:600px){h1{font-size:1.05rem}.filters{grid-template-columns:1fr 1fr}.pb{font-size:.85rem}}
      `}</style>

      <div className="wrap">
        <header>
          <div className="logo">🚀</div>
          <div>
            <h1>SC TRADE FINDER<span>Route optimizer — Powered by UEX Corp</span></h1>
          </div>
          <div className="badge">SC 4.8.0</div>
        </header>

        <div className="filters">
          <div className="fg">
            <label>Nave</label>
            <select value={shipIdx} onChange={e => setShipIdx(+e.target.value)}>
              {SHIPS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Capital (aUEC)</label>
            <input type="number" value={capital} min={1000} step={10000} onChange={e => setCapital(+e.target.value)} />
          </div>
          <div className="fg">
            <label>Sistema</label>
            <select value={system} onChange={e => setSystem(e.target.value)}>
              <option value="all">Todos</option>
              <option value="stanton">Solo Stanton</option>
              <option value="pyro">Solo Pyro</option>
            </select>
          </div>
          <div className="fg">
            <label>ROI mínimo</label>
            <select value={minRoi} onChange={e => setMinRoi(+e.target.value)}>
              <option value={0}>Cualquiera</option>
              <option value={10}>+10%</option>
              <option value={20}>+20%</option>
              <option value={30}>+30%</option>
              <option value={50}>+50%</option>
            </select>
          </div>
          <div className="fg">
            <label>Stock mínimo</label>
            <select value={minFill} onChange={e => setMinFill(+e.target.value)}>
              <option value={0}>Sin filtro</option>
              <option value={25}>≥25% nave</option>
              <option value={50}>≥50% nave</option>
              <option value={75}>≥75% nave</option>
              <option value={100}>Nave llena</option>
            </select>
          </div>
          <div className="fg">
            <label>Mostrar</label>
            <select value={limit} onChange={e => setLimit(+e.target.value)}>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
          <div className="fg">
            <label>Acceso fácil</label>
            <button
              onClick={() => setEasyOnly(!easyOnly)}
              style={{
                background: easyOnly ? 'rgba(0,255,136,0.15)' : '#070d1a',
                border: `1px solid ${easyOnly ? '#00ff88' : '#1a3a6e'}`,
                color: easyOnly ? '#00ff88' : '#7a9cc0',
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '.78rem',
                cursor: 'pointer',
                transition: 'all .2s',
                width: '100%',
              }}
            >
              {easyOnly ? '🛸 Solo orbitales' : '🌍 Todos los accesos'}
            </button>
          </div>
          <div className="fg">
            <label>&nbsp;</label>
            <button className="btn" onClick={fetchRoutes} disabled={status === 'loading'}>
              {status === 'loading' ? '⏳ CARGANDO...' : '⚡ BUSCAR RUTAS'}
            </button>
          </div>
        </div>

        <div className="status">
          <div className={`dot ${status === 'idle' ? '' : status}`} />
          <span>{statusMsg}</span>
          {dataAge && dataAge !== '—' && (
            <span style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'.65rem',color:'#7a9cc0',whiteSpace:'nowrap'}}>
              🕐 {dataAge}
            </span>
          )}
        </div>

        {warning && <div className="warn">⚠️ <span>{warning}</span></div>}
        {isFallback && (
          <div className="fallback-note">
            📦 MODO CACHÉ — Verifica precios en <a href="https://uexcorp.space" target="_blank" style={{color:'#00d4ff'}}>uexcorp.space</a> antes de comprar.
          </div>
        )}

        {routes.length > 0 && (
          <div className="tabs">
            {([
              ['apm',        '⚡ aUEC/minuto',     true],
              ['apgm',       '📡 aUEC/Gm',          true],
              ['profit',     '💰 Mayor beneficio',  false],
              ['roi',        '📈 Mayor ROI %',       false],
              ['investment', '💸 Menor inversión',   false],
              ['ppu',        '🔹 Mejor margen/SCU',  false],
            ] as [SortKey, string, boolean][]).map(([k, label, hl]) => (
              <button
                key={k}
                className={`tab${hl ? ' highlight' : ''}${sortKey===k?' active':''}`}
                onClick={() => setSortKey(k)}
              >{label}</button>
            ))}
          </div>
        )}

        <div className="cards">
          {sorted.length === 0 ? (
            <div className="empty">
              <div className="ei">{status === 'loading' ? '⏳' : '🔍'}</div>
              {status === 'loading' ? 'Consultando UEX Corp...' : 'Sin rutas con estos filtros. Baja el ROI mínimo o el stock mínimo.'}
            </div>
          ) : sorted.map((r, i) => {
            const rank = i + 1
            const profit = getProfit(r, scu)
            const ppu = (r.price_destination||0) - (r.price_origin||0)
            const roi = r.price_roi || 0
            const mins = tripMinutes(r.distance)
            const apm = getApm(r, scu)
            const apgm = r.distance > 0 ? profit / r.distance : 0
            const cross = (r.origin_star_system_name||'').toLowerCase() !== (r.destination_star_system_name||'').toLowerCase()
            const rankIcon = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`#${rank}`
            const roiCls = roi>=50?'g':roi>=25?'y':''
            const stockPct = Math.min(100, ((r.scu_origin||0)/scu)*100)
            const stockCls = stockPct>=75?'g':stockPct>=25?'y':'r'
            const volO = r.volatility_origin || 0
            const volD = r.volatility_destination || 0
            const volMax = Math.max(volO, volD)
            const uexUrl = r.code && !r.code.startsWith('fb')
              ? `https://uexcorp.space/trade/route?code=${r.code}`
              : 'https://uexcorp.space/trade/routes'

            return (
              <div key={r.id} className={`card${rank<=3?` r${rank}`:''}`} style={{animationDelay:`${i*0.04}s`}}>
                <div className="ch">
                  <span className="rk">{rankIcon}</span>
                  <span className="cn">
                    {r.commodity_name}
                    {cross && <span style={{fontSize:'.58rem',color:'#ff9940',fontFamily:"'Share Tech Mono',monospace",marginLeft:8}}>⚡ INTER-SYSTEM</span>}
                  </span>
                  <span className="pb">+{fmt(profit)} aUEC</span>
                </div>

                <div className="path">
                  <div className="loc buy">📦 {r.origin_terminal_name||'—'}<small>{r.origin_star_system_name}</small></div>
                  <span className="arr">→</span>
                  <div className="loc sell">💰 {r.destination_terminal_name||'—'}<small>{r.destination_star_system_name}</small></div>
                  {r.distance > 0 && (
                    <div style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'.68rem',color:'#7a9cc0'}}>
                      📡 {r.distance.toFixed(0)} Gm · ⏱ {fmtTime(mins)}
                    </div>
                  )}
                </div>

                <div className="stats">
                  <div className="st highlight">
                    <div className="sl">aUEC / min ⚡</div>
                    <div className="sv g">{fmt(apm)}</div>
                  </div>
                  <div className="st highlight">
                    <div className="sl">aUEC / Gm 📡</div>
                    <div className="sv g">{r.distance>0?fmt(apgm):'—'}</div>
                  </div>
                  <div className="st">
                    <div className="sl">Compra/SCU</div>
                    <div className="sv">{fmt(r.price_origin)}</div>
                  </div>
                  <div className="st">
                    <div className="sl">Venta/SCU</div>
                    <div className="sv g">{fmt(r.price_destination)}</div>
                  </div>
                  <div className="st">
                    <div className="sl">Margen/SCU</div>
                    <div className="sv g">+{fmt(ppu)}</div>
                  </div>
                  <div className="st">
                    <div className="sl">ROI</div>
                    <div className={`sv ${roiCls}`}>{roi.toFixed?roi.toFixed(0):roi}%</div>
                  </div>
                  <div className="st">
                    <div className="sl">Inversión</div>
                    <div className="sv">{fmt(r.investment||0)}</div>
                  </div>
                  <div className="st">
                    <div className="sl">Stock / nave</div>
                    <div className={`sv ${stockCls}`}>{Math.round(stockPct)}%</div>
                    <div className="fill-bar">
                      <div className="fill-bar-inner" style={{
                        width:`${stockPct}%`,
                        background: stockPct>=75?'#00ff88':stockPct>=25?'#ffd700':'#ff3a3a'
                      }}/>
                    </div>
                  </div>
                  <div className="st">
                    <div className="sl">Volatilidad</div>
                    <div className={`sv ${volColor(volMax)}`}>{volLabel(volMax)}</div>
                  </div>
                </div>

                <a href={uexUrl} target="_blank" rel="noopener noreferrer" className="uex-link">
                  🔗 Ver en UEX Corp
                </a>
              </div>
            )
          })}
        </div>

        <footer>
          Datos de <a href="https://uexcorp.space/trade/routes" target="_blank">UEX Corp</a> vía proxy — SC Trade Finder no está afiliado con CIG ni UEX
        </footer>
      </div>
    </>
  )
}
