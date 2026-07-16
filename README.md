# Family Pal

A mobile-first **PWA** that turns photos of Vietnamese medical documents —
consultation records, prescriptions, and paraclinical results (ultrasound, blood
tests, scans…) — into a **searchable, structured family medical-history book**.
One record per consultation, for every member of the family. Replaces the manual
Google Sheet a caregiver keeps by hand.

UI chrome is English; document content stays Vietnamese.

## How it works

```
photo(s) → compress → /api/ocr (Apple Vision) → /api/structure (local LLM)
        → sectioned review (human confirms/edits) → save
```

- **OCR** runs on **Apple Vision** (`ocrmac`) in a small FastAPI server on the Mac.
- **Structuring** runs on a **local LLM** (LM Studio serving `gemma-4-e4b-it`, MLX)
  with an enforced JSON schema — it fills *only* what is on the document and is
  prompted never to fabricate. A human confirms/edits before saving (medical safety).
- Everything AI is **local and free**; nothing is sent to a third-party model.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript |
| OCR | Apple Vision via `ocrmac` (FastAPI, `ocr-server/`, port 8000) |
| LLM | LM Studio · `gemma-4-e4b-it` (MLX) · OpenAI-compatible API, port 1234 |
| Data | localStorage today; Supabase/Postgres schema ready for Phase 2 |
| Images | client-side canvas compression; Cloudflare R2 wired for Phase 3 |

## Access model & roles

- **Caregiver + profiles.** One caregiver logs in and manages many **profiles**
  (the *patients* — self, kids, parents). Profiles don't log in.
- **Household + co-management.** Multiple **caregivers** can share one household's
  records, with roles enforced everywhere:

  | | View records | Add/edit/delete records | Manage patient profiles | Rename household · manage members |
  | --- | :---: | :---: | :---: | :---: |
  | **Owner** | ✓ | ✓ | ✓ | ✓ |
  | **Editor** | ✓ | ✓ | ✓ | — |
  | **Viewer** | ✓ | — | — | — |

Authorization is one source of truth (`src/lib/permissions.ts`, `can(role, cap)`),
enforced in **two layers**: the UI hides what you can't do, and the mutation layer
(`src/lib/repo.ts`) refuses it. This mirrors the Postgres RLS in
[`supabase/schema.sql`](supabase/schema.sql), which becomes the real enforcement
in Phase 2.

> Auth is currently a **local mock** (magic-link flow simulated on-device) behind
> a swappable interface. Phase 2 replaces it with Supabase magic-link — the screens
> don't change. Owners can use **Household → Preview role** to see the app exactly
> as an Editor or Viewer would.

## Project structure

```
src/
  app/            routes (App Router)
    welcome, signin[/check]          onboarding + mock magic-link auth
    setup, page, account             first-run profile, home, account
    household[/invite], join/[token] co-management: members, roles, invites
    profiles[/[id]]                  patient profiles CRUD
    capture, visit/[id][/edit]       capture → AI read → review; detail; edit
    api/{ocr,structure,upload}       OCR proxy, LLM structuring, R2 upload
  components/     AuthProvider · Header · ProfileForm · VisitForm
  lib/            auth · permissions · repo · types · ui · compress ·
                  extract · captureBuffer · supabase (dormant, Phase 2)
ocr-server/       FastAPI + Apple Vision OCR (main.py, requirements.txt)
supabase/         schema.sql (households, profiles, visits + children, RLS)
docs/             HANDOFF.md + design/ (prototypes & original design handoff)
```

## Run locally

```bash
# 1. OCR server (Apple Vision)
cd ocr-server
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first time
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Local LLM (LM Studio) — model JIT-loads on first request
lms server start        # or launch the LM Studio app

# 3. App
npm install
npm run dev             # http://localhost:3000  (phone: http://<mac-ip>:3000)
```

Copy `.env.local.example` → `.env.local`:

```
OCR_ENDPOINT=http://localhost:8000/ocr
LMSTUDIO_URL=http://localhost:1234/v1
STRUCTURE_MODEL=gemma-4-e4b-it
# Supabase / R2 vars stay blank until Phase 2 / 3.
```

> Vietnamese OCR uses the language code `vi-VT` (not `vi-VN`), and `gemma-4-e4b-it`
> needs LM Studio's **MLX runtime ≥ 1.9.0 (beta)** to load.

## Roadmap

- **Phase 1 — ✅ done.** localStorage, no accounts. Capture → AI → review → save,
  editable records, fees, multi-image capture.
- **Phase 2a/2b — ✅ done.** Mock auth + household + co-management UI + role-based
  access control (owner/editor/viewer).
- **Phase 2 — next.** Real Supabase magic-link auth + cloud sync (run `schema.sql`,
  implement `SupabaseRepo` behind the existing `Repo` interface).
- **Phase 3.** Cloudflare R2 for images (code wired; needs an account).
- **Phase 4.** Deploy: frontend on Vercel, Mac AI reached via Cloudflare Tunnel.
