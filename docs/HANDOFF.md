# Family Pal — Project Handoff

## What it is
A mobile-first **PWA** that turns photos of hospital papers (Vietnamese diagnosis
/ prescription documents) into a **searchable family medical-history book**. You
snap the exam result + prescription, on-device AI reads them into structured
fields, you add your own notes, and it's saved as a browsable record per family
member. It replaces a manual Google Sheet the family kept.

## The core pipeline (hybrid capture)
```
photo → compress → /api/ocr (Apple Vision, local)      → raw text
                 → /api/structure (LLM, local)          → structured fields
                 → confirm/edit form (human in the loop) → save
```
- **AI fills only photo-derivable fields** (`disease_category`, `hospital`,
  `visit_time`, `medicines`, and symptoms/treatment/cost/insurance *if printed*).
  It is prompted to **never fabricate** — blank if not on the document.
- **User types observations** the paper doesn't contain (symptoms, treatment,
  cost, insurance). Extraction never overwrites a field the user already typed.
- The confirm screen exists so a wrong OCR/LLM read is fixed **before** it's saved
  (medical data — a confident wrong value is worse than a blank).

## Tech stack
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4, TypeScript.
  Font: Plus Jakarta Sans (`next/font`, latin+vietnamese). Design = indigo +
  soft cards (see `design_handoff_home_redesign/` for the reference mockups).
- **OCR:** self-hosted **Apple Vision** via `ocrmac` in a FastAPI server
  (`ocr-server/`), port 8000. Free, private, runs on the Mac's GPU.
- **LLM (structuring):** **LM Studio** running `gemma-4-e4b-it` (MLX, ~5 GB),
  OpenAI-compatible API on port 1234. Enforces JSON schema output.
- **Records:** localStorage today; **Supabase** (Postgres) wired, activates when
  env is set.
- **Images:** **Cloudflare R2** wired (`/api/upload`), activates when env is set.

## File map (`src/`)
- `app/page.tsx` — Home / record list (month groups, category tiles, member
  avatars, sort pill, search, "Add record" FAB that opens the camera).
- `app/capture/page.tsx` — 3-step capture: **add photos → AI reading (loading
  view) → review & save**. Holds `extractFrom()` (the OCR+structure calls),
  compression, the Auto-filled vs Your-notes form, member pills, sticky save.
- `app/visit/[id]/page.tsx` — Visit detail (hero card, info table, symptoms,
  medicines, attached photos).
- `app/api/ocr/route.ts` — forwards image to `OCR_ENDPOINT`; sample fallback if unset.
- `app/api/structure/route.ts` — sends OCR text + images to LM Studio with a
  Vietnamese prompt + JSON schema; regex-free empty fallback on failure.
- `app/api/upload/route.ts` — uploads a data-URL image to R2, returns public URL.
- `lib/types.ts` — `Visit`, `Member`, `StructuredResult`, `NewVisitInput`.
- `lib/repo.ts` — data layer. `Repo` interface with `LocalRepo` (localStorage)
  and `SupabaseRepo` (Supabase + R2). `repo()` auto-selects by env.
- `lib/compress.ts` — client-side canvas image compression (~2000px, JPEG 0.75).
- `lib/ui.tsx` — shared: category keyword→icon/color mapping (Vietnamese-aware),
  member color palette (by index), date formatters, all inline SVG icons.
- `lib/captureBuffer.ts` — in-memory handoff of the photo from Home FAB → /capture
  (avoids sessionStorage quota with big base64).
- `lib/supabase.ts` — dormant browser client (repo.ts uses supabase-js directly).
- `ocr-server/main.py` — FastAPI + Apple Vision OCR.
- `supabase/schema.sql` — Postgres schema (POC: single "family" account).

## Data model (mirrors the family's real sheet)
`visit_time, disease_category, symptoms, hospital, treatment, medicines, cost,
insurance, exam_image_url, prescription_image_url, raw_text` + member + timestamps.
Medicines is free text (matches the sheet). Content is **Vietnamese**; UI is English.

## Running it locally
```bash
# 1. OCR server
cd ocr-server && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
# 2. LM Studio server (model JIT-loads on first request)
~/.cache/lm-studio/bin/lms server start
# 3. app
npm run dev        # http://localhost:3000  (phone: http://<mac-ip>:3000)
```
`.env.local` sets `OCR_ENDPOINT`, `LMSTUDIO_URL`, `STRUCTURE_MODEL`. With no
Supabase/R2 env, the app runs fully on localStorage.

## AI on/off behavior (already automatic)
LM Studio **JIT-loads** the model on a request and **auto-unloads** after ~60 min
idle (frees the 5 GB RAM). Only the lightweight server process must stay running.
First request after idle pays a ~20–35 s cold start. Enable "Run server on login"
in LM Studio to survive reboots.

## Deployment plan (in progress — NOT done)
Target: **FE on Vercel**. The blocker: Vercel's serverless functions can't reach
the Mac's `localhost` AI. Plan:
- **Cloudflare Tunnel** exposes OCR (:8000) + LM Studio (:1234) → public URLs;
  set `OCR_ENDPOINT` / `LMSTUDIO_URL` on Vercel to those. Mac must be on + tunnel up.
- **Supabase** for records, **Cloudflare R2** for images (10 GB free, zero egress).
  Both are coded and env-gated; they need accounts created + keys set (see below).
- Compress-on-capture keeps payloads under Vercel's ~4.5 MB body limit.

### To activate cloud storage
1. Supabase project → run `supabase/schema.sql` → set `NEXT_PUBLIC_SUPABASE_URL` +
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Cloudflare R2 bucket (public) + API token → set `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
See `.env.local.example`.

## Non-obvious gotchas (hard-won — read before touching)
- **gemma4 needs LM Studio MLX runtime ≥ 1.9.0** (beta). The stable 1.8.5 can't
  load the `gemma4_unified` arch (mlx_vlm error).
- **Vietnamese OCR language code is `vi-VT`, not `vi-VN`** in macOS Vision.
- **Ollama's MLX runner ignores the JSON-schema `format`** (open bug #16776) — that
  is *why* we use LM Studio (its MLX engine adds the Outlines constraint layer).
  Do not "simplify" back to Ollama expecting enforced JSON.
- **iOS opens the camera only from a direct tap on a file input** — that's why the
  FAB and photo slots are `<label>`+hidden `<input capture>`, not buttons+JS.
- **npm registry is flaky on this Mac** — install with
  `--registry=https://registry.npmmirror.com` if `registry.npmjs.org` stalls.
- **Vercel functions run in the cloud**, so any `localhost` AI call fails there
  without the tunnel.

## Status
- ✅ Full UI redesigned (Home, Capture 3-step, Detail) — English, Plus Jakarta Sans.
- ✅ OCR (Vietnamese) + LM Studio structuring, end-to-end verified locally.
- ✅ Compression live. Supabase + R2 code complete (needs accounts to activate).
- ⏳ Pending: create Supabase/R2 accounts, set up Cloudflare Tunnel, deploy to
  Vercel, **add auth before going public** (POC uses public anon key + permissive
  RLS — see the SECURITY note in `schema.sql`).
- Known: old localStorage records created before the schema change use the old
  shape (blank new fields). Real-paper OCR accuracy tested only on one sample.
