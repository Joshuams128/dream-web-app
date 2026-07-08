# Dream Build Group — Material Price Calculator

A mobile-first quoting tool for a small construction / renovation company. A
non-technical contractor can stand in a client's kitchen, enter (or **scan**)
room measurements, pick a material, and produce a clean, defensible quote in
seconds.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**, deployable to
**Vercel**.

---

## Features

- **Manual measurements** — rows of Length × Width (ft) with live per-row square
  footage and a running total. Add/remove rows freely; decimals supported; the
  numeric keypad shows on mobile (`inputmode="decimal"`).
- **Scan measurements from a photo (AI vision)** — snap a photo of a handwritten
  note; the app calls Claude (newest Sonnet) server-side to extract every
  `length × width` pair, then shows them in an **editable review state** so you
  can correct any misread number before confirming. Handwriting OCR is never
  silently trusted.
- **Material-based pricing** with two layers:
  1. **Local price list (source of truth)** — ~15 seeded flooring/reno line
     items with Toronto/GTA ranges (material vs. installed cost). Fully editable
     in **Settings**.
  2. **AI price suggestion (assist)** — for a material not in your list, Claude
     (with web search) returns a typical **installed price/sq ft for Ontario in
     2026**, clearly labelled *"Suggested market range — verify before quoting"*,
     with a one-tap **Save to price list** so it becomes editable.
- **Quote summary** — material, total sq ft, rate, subtotal, optional contingency
  %, editable HST (default 13%), and grand total. The **math is always shown**
  (`646.5 sq ft × $4.00 = $2,586.00`). Ranges show low/high totals.
- **Copy quote** (plain text) and **Print / Save-as-PDF** (print stylesheet shows
  only the summary).
- **Persistence** — price list and last session are saved to `localStorage`. The
  session resumes when you reopen the tab.

---

## Getting started

Requires Node 18.18+ (Node 20+ recommended).

```bash
npm install
cp .env.example .env.local   # then paste your Anthropic API key
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

| Variable            | Required | Purpose                                                          |
| ------------------- | :------: | --------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` |   Yes    | Used **server-side only** in the two `/api` routes. Never sent to the browser. Get one at <https://console.anthropic.com/>. |

The manual calculator, price list, and quote work **without** a key — only the
two AI features (photo scan, price suggestion) need it.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo (framework auto-detected
   as Next.js).
3. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`.
4. Deploy. The AI routes run as serverless functions (`maxDuration = 60s`).

> The `.env.local` file is git-ignored and never committed — set the key in
> Vercel's dashboard, not in code.

---

## Editing the material price list

Tap the **⚙︎ gear** on the home screen (or go to `/settings`).

- Edit any name, category, notes, and the four price columns (material low/high,
  installed low/high). Changes **save automatically** to your device.
- **+ Add material** for a new line item; the trash icon deletes one.
- **Reset** restores the default seeded prices.
- Labour-only items (e.g. "Flooring removal") keep material cost at `$0` and put
  the labour rate in the installed columns.

Your saved prices always take precedence over AI/internet averages — an
AI-suggested rate is only ever added to a quote after you save it and select it.

---

## How the AI is used (and kept safe)

- `POST /api/extract-measurements` — sends the uploaded image to Claude with a
  strict extraction prompt, parses the JSON **defensively** (strips code fences,
  `try/catch`), and **validates every number** (rejects negatives, zeros, and
  absurd values > 1000 ft). Returns rows for the review step.
- `POST /api/suggest-price` — asks Claude (web-search tool enabled) for the
  typical installed price/sq ft in Ontario 2026, returns a low/high range plus
  sources. Always shown as a **suggestion**, never auto-inserted into a quote.
- Both routes are **lightly rate-limited** (in-memory, per IP — see
  `lib/rateLimit.ts`) so a misbehaving client can't burn API credits. For
  production, swap the in-memory Map for an Upstash Redis counter (the function
  signature stays the same).

---

## Project layout

```
app/
  page.tsx                     # main calculator (client)
  settings/page.tsx            # editable price list
  api/extract-measurements/    # AI vision route (server)
  api/suggest-price/           # AI web-search route (server)
components/                     # MeasurementRows, ScanModal, MaterialPicker,
                               # RateControls, QuoteSummary
lib/
  store.ts                     # SINGLE data-access seam (localStorage today,
                               #   swap to Supabase here — see below)
  types.ts  seed.ts  quote.ts  format.ts  rateLimit.ts  anthropic.ts
```

### Swapping localStorage for Supabase later

Every read/write of the price list and session goes through `lib/store.ts`, and
its functions are already `async`. To move to Supabase you only edit that one
file — no call sites change. Suggested tables:

- `materials (id, name, unit_price_low, unit_price_high, unit, notes, updated_at)`
- `quotes (id, data jsonb, created_at)`

No auth is needed for v1 (single-business internal tool); routes are structured
so adding Supabase Auth later doesn't require a rewrite.
