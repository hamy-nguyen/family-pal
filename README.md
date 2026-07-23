# Family Pal

A mobile-first **PWA** that turns photos of Vietnamese medical documents —
consultation records, prescriptions, and paraclinical results (ultrasound, blood
tests, scans…) — into a **searchable, structured family medical-history book**.
One record per consultation, for every member of the family. Replaces the manual
Google Sheet a caregiver keeps by hand.

Live on Vercel and installable to the home screen. UI chrome is English; document
content stays Vietnamese.

## How it works

```
capture / library → compress → /api/ocr (Apple Vision) → /api/structure (local LLM)
        → sectioned review (human confirms/edits) → save
```

1. **Add photos** — snap several pages in a row with the in-app camera (stays open
   across shots), or pick from the library. Every step lets you review the photos
   full-screen.
2. **OCR** runs on **Apple Vision** (`ocrmac`) in a small FastAPI server on the Mac.
3. **Structuring** runs on a **local LLM** (LM Studio serving `gemma-4-e4b-it`, MLX)
   with an enforced JSON schema — it fills *only* what is on the document and is
   prompted never to fabricate.
4. **Review** — a human confirms/edits the sectioned record before saving (medical
   safety), then it's searchable by keyword, member and date.

The AI stays **local**: OCR and the LLM both run on the Mac, reached by the hosted
app over a private tunnel; nothing is sent to a third-party model.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · TypeScript |
| Auth | Supabase email + password, with email confirmation and auto-login on verify |
| Data | Supabase Postgres + Row-Level Security (localStorage fallback when unset) |
| Images | client-side canvas compression → Supabase Storage (private bucket `visit-images`) |
| Capture | in-app multi-shot camera (`getUserMedia`) + native library picker + full-screen viewer |
| OCR | Apple Vision via `ocrmac` (FastAPI, `ocr-server/`, port 8000) |
| LLM | LM Studio · `gemma-4-e4b-it` (MLX) · OpenAI-compatible API, port 1234 |
| Hosting | Vercel (frontend) · Mac AI exposed via **Tailscale Funnel** |

Both the auth and data layers sit behind swappable interfaces
(`src/lib/auth.ts`, `src/lib/repo.ts`) and switch on `supabaseConfigured`: with the
Supabase env vars set they use the real backend, otherwise a local on-device mock.
Screens only ever `await auth.*` / `repo().*`.

## Access model & roles

- **Accounts + profiles.** A person signs in with an account and manages many
  **profiles** (the *patients* — self, kids, parents). Profiles don't log in.
- **Ownership + grants.** Every profile is **owned by exactly one principal** —
  an account (using the app solo) **or** a household — and can be **granted** to
  other households or accounts as a co-manager, editor or viewer. This is what lets
  a profile move between "just me" and shared-family use without being trapped in
  one household.
- **Roles**, enforced everywhere:

  | | View records | Add/edit/delete records | Manage patient profiles | Rename household · manage members |
  | --- | :---: | :---: | :---: | :---: |
  | **Owner** | ✓ | ✓ | ✓ | ✓ |
  | **Editor** | ✓ | ✓ | ✓ | — |
  | **Viewer** | ✓ | — | — | — |

Authorization is one source of truth (`src/lib/permissions.ts`, `can(role, cap)`),
enforced in **two layers**: the UI hides what you can't do, and — the real gate —
**Postgres Row-Level Security** in Supabase refuses it. RLS reads through the
`auth_can_view_profile` / `auth_can_edit_profile` helpers, and mutations that RLS
`WITH CHECK` can't express (create/delete profile, save/update visit, accept
invite) go through `SECURITY DEFINER` RPCs so the policy check happens in one place.

## Project structure

```
src/
  app/            routes (App Router)
    welcome, signin                    onboarding + Supabase email/password auth
    onboarding[/family]                solo vs family setup; add members
    setup, page, account               first-run profile, home, account
    household[/invite], join/[token]   co-management: members, roles, invites
    profiles[/[id]]                    patient profiles CRUD
    capture, visit/[id][/edit]         capture → AI read → review; detail; edit
    api/{ocr,structure}                Apple Vision OCR proxy, LLM structuring
  components/     AuthProvider · Header · VisitForm · ProfileForm ·
                  AddPhotos · CameraCapture · PhotoViewer
  lib/            auth(.supabase) · repo(.supabase) · permissions · household ·
                  types · ui · compress · extract · uploadImage · captureBuffer ·
                  onboarding · supabase
ocr-server/       FastAPI + Apple Vision OCR (main.py, requirements.txt)
supabase/         schema.sql · migrate_activate.sql · migrate_comanagement_v2.sql
                  (households, profiles + owner/grant model, visits, RLS, RPCs)
docs/             HANDOFF.md · prototype.html · design/ (prototypes & handoff)
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
# Local AI on the Mac (localhost here; set to the tunnel URLs on Vercel)
OCR_ENDPOINT=http://localhost:8000/ocr
LMSTUDIO_URL=http://localhost:1234/v1
STRUCTURE_MODEL=gemma-4-e4b-it

# Supabase — records, auth, and image storage. Leave blank to run fully local.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

To activate the backend: create a Supabase project, run `supabase/schema.sql` then
`supabase/migrate_comanagement_v2.sql` in the SQL editor, create the private
`visit-images` Storage bucket, and set the two `NEXT_PUBLIC_SUPABASE_*` vars.

> Notes: Vietnamese OCR uses the language code `vi-VT` (not `vi-VN`); `gemma-4-e4b-it`
> needs LM Studio's **MLX runtime ≥ 1.9.0 (beta)** to load; and the in-app camera
> (`getUserMedia`) needs a secure context — it works on `localhost` and over HTTPS,
> but not plain-HTTP LAN.

## Deploy

- **Frontend** on **Vercel** (`main` auto-deploys). Set the `NEXT_PUBLIC_SUPABASE_*`
  vars, plus `OCR_ENDPOINT` / `LMSTUDIO_URL` pointing at the tunnel.
- **Mac AI** stays on the Mac and is exposed to Vercel with **Tailscale Funnel**
  (a stable `*.ts.net` hostname → OCR :8000 and LM Studio :1234). `caffeinate`
  keeps the Mac awake to serve requests.

## Roadmap

- **Phase 1 — ✅ done.** Capture → AI → review → save, editable records, fees,
  multi-image capture, accent-insensitive search.
- **Phase 2 — ✅ done.** Real Supabase email/password auth (with email confirmation
  + auto-login), Postgres + RLS cloud sync, images in Supabase Storage, and the full
  household **co-management** feature on the ownership + grants model.
- **Phase 3 — ✅ done.** Deployed: frontend on Vercel, Mac AI reached via Tailscale
  Funnel. In-app multi-shot camera + library capture + full-screen photo viewer.
- **Next.** Multi-language document support, per-record sharing links, and moving
  the local LLM to an always-on host so the Mac needn't stay awake.
```
