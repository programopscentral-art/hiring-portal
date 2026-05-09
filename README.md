# ProgramOps · Hiring Portal

A Svelte (SvelteKit + Vite) hiring dashboard that reads two Google Sheets — the per-candidate **master tracker** and the weekly **activity tracker + hiring plan** — and joins them into a single live view.

## Features

- **Dashboard** — University location cards (property-listing style) on the left, India map with state-level pins on the right, KPIs, recent activity feed, monthly trend sparkline.
- **Plan vs Actual** — Position breakdown by state/role/university, donut summaries, full plan table.
- **Funnel** — Per-role funnels (PMA/PM/COS/BOA), stage-by-stage drop-off, master-pipeline funnel when populated.
- **Candidates** — Filterable list with search, pulled from both sheets, with a deep **360 timeline** page per candidate.
- **Analytics** — Sources, team productivity (sourcers + panelists), monthly trends, operational queues (assignment overdue, awaiting screening, BGV in progress, etc.).
- **Settings** — Connect / disconnect sheets, configure auto-refresh, download the Apps Script proxy.

## Quick start

```bash
npm install
npm run dev
```

The portal opens at `http://localhost:5173`. Go to **Settings** → paste your two sheet URLs → **Connect**.

## Data sources

Two URL formats are supported:

1. **Apps Script `/exec` URL** (recommended for **private** sheets) — see `apps-script.gs` and follow the steps in Settings.
2. **Public Google Sheet share URL** ("Anyone with the link can view") — pasted directly.

The portal joins both sheets on candidate name. Candidates that exist only in the tracker (not yet logged in the master sheet) appear as "tracker-only" rows.

## Build for production

```bash
npm run build
npm run preview
```

The static build lands in `build/` and can be hosted on any static host (Vercel, Netlify, GitHub Pages, S3, an internal nginx — anywhere).

## Data refresh

Configurable in Settings (1 min → 30 min). The portal cache-busts every fetch, so what you see is what's currently in the sheet (with the usual ~5 min Google publish-to-web cache, if you're using that path).

## Tech

- SvelteKit 2 + Svelte 5
- Vite 8
- Static adapter — no backend required
- Vanilla CSS design system (no Tailwind / framework)
- Pure client-side data layer — sheets fetched directly in the browser

## Structure

```
src/
  app.css                  Design system (cream + ink + terracotta + sage)
  app.html                 Root document
  lib/
    components/            Sidebar, Topbar, StatCard, UniversityCard, IndiaMap,
                           Funnel, Donut, Sparkline, Filters, Toaster, etc.
    data/
      csv.js               RFC4180-ish CSV parser
      sheets.js            URL handling + fetch
      parse.js             Master + tracker sheet parsers
      normalize.js         Merge candidates with tracker events
      derive.js            All derived metrics (funnel, plan, sources, ...)
      states.js            Indian state coordinates for the map
      stores.js            Svelte stores + lifecycle (auto-refresh, etc.)
      storage.js           localStorage persistence
  routes/
    +layout.svelte         Shell (sidebar + topbar)
    +page.svelte           Dashboard
    plan/+page.svelte      Plan vs Actual
    funnel/+page.svelte    Funnel & drop-off
    candidates/+page.svelte
    candidates/[id]/+page.svelte    Candidate 360
    analytics/+page.svelte Sources / team / trends / queues
    settings/+page.svelte  Connection + Apps Script
```
