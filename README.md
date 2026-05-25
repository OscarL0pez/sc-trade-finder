# SC Trade Finder 🚀

Buscador de rutas de trading para Star Citizen en tiempo real, usando la API pública de UEX Corp como proxy server-side (sin problemas de CORS).

## Stack
- **Next.js 15** App Router
- **TypeScript**
- **Vercel** (deploy)
- **UEX Corp API** (datos de trading)

## Estructura
```
src/app/
  api/routes/route.ts   ← Proxy server-side hacia UEX (evita CORS)
  page.tsx              ← Frontend completo
  layout.tsx            ← Layout con fuentes
```

## Deploy en Vercel (5 minutos)

### Opción A — GitHub + Vercel (recomendado)

1. Sube el proyecto a un repo de GitHub:
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/TU_USUARIO/sc-trade-finder.git
git push -u origin main
```

2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa el repo
3. Vercel detecta Next.js automáticamente → **Deploy**
4. En ~2 minutos tienes la URL pública ✅

### Opción B — Vercel CLI

```bash
npm install -g vercel
npm install
vercel
```

## Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Cómo funciona el proxy

El frontend llama a `/api/routes?scu=64&investment=500000`
↓
El API Route de Next.js (server-side) llama a `https://uexcorp.space/api/2.0/trade_routes`
↓
Devuelve los datos al frontend sin problemas de CORS

Los datos se cachean 2 minutos en el edge para no saturar UEX.

## Filtros disponibles
- **Nave** → SCU máximos de carga
- **Capital** → solo rutas que puedes pagar
- **Sistema** → Stanton / Pyro / Todos
- **ROI mínimo** → filtra por rentabilidad
- **Ordenar** → por beneficio total, ROI%, menor inversión, mejor precio/SCU
