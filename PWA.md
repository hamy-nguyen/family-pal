# PWA deployment — install & test on a mobile phone

> DECISION MADE: **Path ③ — Vercel + tunnel the AI.** PWA code is done; the Vercel
> + Cloudflare Tunnel steps are below under "Your steps."

## Goal
Install Family Pal as a PWA on a phone and use it (photo → AI → save, records,
co-management).

## The four requirements (and current status)

| Requirement | Why | Status |
| --- | --- | --- |
| **HTTPS** | Phones require it to install a PWA and run a service worker (localhost is exempt, but a phone isn't localhost) | ❌ dev server is HTTP |
| **App icons** (192 + 512 PNG) | Home-screen icon; manifest currently points at `icon-192.png` / `icon-512.png` | ❌ referenced but the files don't exist (manifest 404s) |
| **Service worker** | Android install prompt + offline (iOS "Add to Home Screen" works without one) | ❌ none (no next-pwa/serwist installed) |
| **Mac's local AI reachable** | OCR (Apple Vision, `localhost:8000`) + gemma (LM Studio, `localhost:1234`) power the photo flow | ⚠️ only works if the app runs on/near the Mac |

Notes:
- Supabase (auth/data/images) is already **cloud** → works from anywhere.
- We use **email + password** auth now → **no magic-link redirect to configure**
  (one less deploy step). Only "Confirm email" stays OFF in Supabase.
- Manifest also has a stale `theme_color: #0ea5e9` (app primary is `#6366f1`).
- Mac LAN IP at time of writing: `192.168.30.207`.

## The deciding factor: local AI
OCR + gemma live on the Mac's `localhost`. Wherever the app runs, `/api/ocr` and
`/api/structure` must be able to reach them:
- App running **on the Mac** (dev server, LAN or tunneled) → `localhost` reaches the AI → works.
- App running **on Vercel** → cannot reach Mac localhost → needs a tunnel exposing the AI.

## Three paths (pick one — OPEN DECISION)

### ① LAN, right now — quickest functional test (not a true PWA)
- Open `http://192.168.30.207:3000` on the phone (same WiFi) with `npm run dev` +
  OCR server + LM Studio running on the Mac.
- App + AI + Supabase all work. iOS can "Add to Home Screen" for an app-like icon.
- **Limits:** HTTP → no service worker/offline, and Android shows no install prompt.

### ② Cloudflare Tunnel to the Mac — RECOMMENDED (real installable PWA)
- `cloudflared tunnel --url http://localhost:3000` → free `https://…trycloudflare.com` URL.
- Open on phone → proper PWA install + service worker; AI works (all on the Mac).
- **Cost:** free. **Caveats:** Mac must stay on; URL changes per run unless a named tunnel.

### ③ Vercel + tunnel the AI — production-ish, always-on
- Deploy frontend to Vercel (free HTTPS, always-on).
- Also run a Cloudflare Tunnel exposing the Mac's OCR (8000) + LM Studio (1234);
  set Vercel env `OCR_ENDPOINT` / `LMSTUDIO_URL` to the tunnel URLs (+ the
  `NEXT_PUBLIC_SUPABASE_*` vars).
- **Most "real", most setup;** AI still depends on the Mac being on + tunneled.

## Who does what
- **Claude can do now (any path, no cost):**
  - generate real 192 + 512 icons (+ `apple-touch-icon`)
  - add a lightweight service worker + install meta
  - fix the manifest (icons + `theme_color`)
- **User does:**
  - ② / ③: install & run `cloudflared` (free)
  - ③: create the Vercel project + set env vars

## DECIDED: Path ③ — Vercel + tunnel the AI

### ✅ Code done (committed)
- Real icons: `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
- Service worker `public/sw.js` (+ `components/ServiceWorker.tsx`, prod-only, safe:
  network-first navigations, cross-origin/mutations never cached)
- Manifest theme/background aligned; `apple-touch-icon` + `theme-color` in layout
- `export const maxDuration = 60` on `/api/ocr` and `/api/structure` (Vercel Hobby max)

### Your steps

**A. Deploy the frontend to Vercel**
1. vercel.com → sign in with GitHub (**hamy-nguyen**).
2. Add New Project → Import `hamy-nguyen/family-pal` (Next.js auto-detected).
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key
   - `STRUCTURE_MODEL` = `gemma-4-e4b-it`
   - `OCR_ENDPOINT` / `LMSTUDIO_URL` = fill in after step B
4. Deploy → note the `https://family-pal-*.vercel.app` URL.

**B. Tunnel the Mac AI (Cloudflare)**
1. `brew install cloudflared`
2. Start the Mac AI: OCR server on :8000 and LM Studio server on :1234.
3. Two quick tunnels (each in its own terminal — each prints an https URL):
   - `cloudflared tunnel --url http://localhost:8000`  → `https://<ocr>.trycloudflare.com`
   - `cloudflared tunnel --url http://localhost:1234`  → `https://<lm>.trycloudflare.com`
4. Set the Vercel env (then **redeploy** — env changes need a rebuild):
   - `OCR_ENDPOINT`  = `https://<ocr>.trycloudflare.com/ocr`
   - `LMSTUDIO_URL`  = `https://<lm>.trycloudflare.com/v1`

**C. On your phone**
Open the Vercel URL → **Add to Home Screen** (installs the PWA). Sign in
(email+password), use it. Photo→AI works only while the Mac + tunnels are up.

### Caveats / gotchas
- **Quick-tunnel URLs change** every restart → you must re-update the Vercel env +
  redeploy. For a stable URL, set up a *named* tunnel (needs a Cloudflare account +
  a domain) later.
- **Mac must be on** with servers + tunnels running for the AI. If it's off, the app
  still works (records, co-management); photo→AI degrades gracefully ("Reading
  failed → Fill by hand").
- **LM Studio cold start** can exceed Vercel's 60s cap → keep the gemma model
  loaded (disable auto-unload / raise TTL) so calls stay warm.
- No magic-link redirect config needed (email+password auth). Keep Supabase
  "Confirm email" OFF.
