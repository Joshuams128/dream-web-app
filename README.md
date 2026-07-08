# Dream Build Group — Material Price Calculator

A mobile-first quoting tool for a small construction / renovation company. A
non-technical contractor can walk a whole house, add a **section for each room**
(washroom, living room, …), enter (or **scan**) each room's measurements, pick a
material **per section**, and produce one clean, defensible quote that adds every
room together — in seconds.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS**, deployable to
**Vercel**.

---

## Features

- **Multiple sections (rooms) per quote** — a quote is a list of named sections
  (e.g. *Washroom*, *Living room*). Each section has **its own measurements,
  material, and rate**, and is priced independently; the quote summary shows a
  per-section breakdown and sums every section into one subtotal. Add/remove
  sections freely — a full-house quote is just several rooms stacked up. One
  contingency % and HST apply once to the combined total.
- **Manual measurements** — per section, rows of Length × Width (ft) with live
  per-row square footage and a running section total. Add/remove rows freely;
  decimals supported; the numeric keypad shows on mobile (`inputmode="decimal"`).
- **Scan measurements from a photo (AI vision)** — inside any section, snap a
  photo (or screenshot) of that room's handwritten note; the app calls Claude
  (newest Sonnet) server-side to extract every `length × width` pair, then shows
  them in an **editable review state** so you can correct any misread number
  before confirming. Scanned rows are added to the section you scanned from.
  Handwriting OCR is never silently trusted.
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
- **Invoice / Estimate PDF export** — from the quote summary, tap **Turn into
  invoice** to open the invoice modal. Each section becomes an editable
  **Scope of Work line** (description + firm per-sq-ft rate, since an invoice
  needs a single rate rather than a range); fill in client details, HST#,
  job-site address, and **Notes & Disclaimer** (pre-filled with a standard
  construction disclaimer, or click **AI rewrite** to get a tailored version
  based on the specific materials/scope). The exported PDF includes the Dream
  Build Group logo, Estimate #, Bill To, a **multi-line Scope of Work table**
  (one row per section), contingency/HST/Total block, disclaimer, and a branded
  footer. Invoice numbers auto-increment.
- **Auto-price in Settings** — when adding a new material, type its name and tap
  **✨ Auto-price**; the app searches GTA 2026 market data and fills in the
  installed price range automatically.
- **Persistence** — price list, last session, and business info (name, HST#, etc.)
  are saved to `localStorage`. The session resumes when you reopen the tab.

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

| Variable                        | Required | Purpose                                                          |
| ------------------------------- | :------: | --------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      |   Yes    | Supabase project URL, e.g. `https://xxxx.supabase.co`. Public (browser). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |   Yes    | Supabase **anon / publishable** key (`sb_publishable_…`). Public (browser). **Never** the `service_role` / secret key. |
| `ANTHROPIC_API_KEY`             |   Yes*   | Used **server-side only** in the `/api` routes. Never sent to the browser. Get one at <https://console.anthropic.com/>. |

The two `NEXT_PUBLIC_SUPABASE_*` values gate access — the app requires login. \*The
`ANTHROPIC_API_KEY` is only needed for the AI features (photo scan, price suggestion,
AI notes/auto-price); the calculator, quote, and invoice PDF work without it.

Find the Supabase values in the dashboard under **Project Settings → API**. Use the
anon/publishable key — the `service_role` (secret) key must never appear in client code
or `NEXT_PUBLIC_*` vars.

---

## Authentication (Supabase Auth — email + password)

Single-owner internal tool: there is **no public sign-up**. Create the one login manually in
the Supabase dashboard (**Authentication → Users → Add user**), and keep public sign-ups
disabled (**Authentication → Providers → Email → "Enable sign-ups" off**).

- Built on `@supabase/ssr` (browser + server clients in `utils/supabase/`).
- `proxy.ts` (Next 16's renamed middleware) refreshes the session on every request and
  redirects any unauthenticated request to `/login`. The token refresh keeps the owner
  logged in indefinitely until they hit **Sign out** in the header.
- `/login` is a plain email + password form; wrong credentials show *"Incorrect email or
  password"*. No sign-up, reset, or OAuth in v1.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo (framework auto-detected
   as Next.js).
3. Under **Settings → Environment Variables**, add all three, for the **Production**
   (and Preview) environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy. The AI routes run as serverless functions (`maxDuration = 60s`).

> The `.env.local` file is git-ignored and never committed — set these in
> Vercel's dashboard, not in code.

---

## Editing the material price list

Tap the **⚙︎ gear** on the home screen (or go to `/settings`).

- Edit any name, category, notes, and the four price columns (material low/high,
  installed low/high). Changes **save automatically** to your device.
- **+ Add material** for a new line item; tap **✨ Auto-price** (after typing a
  name) to have Claude search GTA 2026 market data and fill in the installed
  price range; the trash icon deletes one.
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
  Also used by the **Auto-price** button in Settings.
- `POST /api/describe` — generates either a **line-item description** (one
  sentence, `type: "description"`) or a **Notes & Disclaimer paragraph**
  (`type: "notes"`) tailored to the specific material, scope, and area. Used by
  the invoice modal's Auto-write and AI rewrite buttons.
- All routes are **lightly rate-limited** (in-memory, per IP — see
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
  api/describe/                # AI line-item description + notes route (server)
components/                     # SectionCard (one room: measurements + material
                               #   + rate), MeasurementRows, ScanModal,
                               #   MaterialPicker, RateControls, QuoteSummary,
                               #   InvoiceModal
lib/
  store.ts                     # SINGLE data-access seam (localStorage today,
                               #   swap to Supabase here — see below)
  invoice.ts                   # PDF export logic (jsPDF + autotable, lazy-loaded)
  types.ts  seed.ts  quote.ts  format.ts  rateLimit.ts  anthropic.ts
public/
  imgs/logo-2.png              # logo embedded in exported PDFs
```

### Swapping localStorage for Supabase later

Every read/write of the price list and session goes through `lib/store.ts`, and
its functions are already `async`. To move to Supabase you only edit that one
file — no call sites change. Suggested tables:

- `materials (id, name, unit_price_low, unit_price_high, unit, notes, updated_at)`
- `quotes (id, data jsonb, created_at)`

No auth is needed for v1 (single-business internal tool); routes are structured
so adding Supabase Auth later doesn't require a rewrite.
