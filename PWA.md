# PWA deployment — install & test on a mobile phone

> Parked for later. This records the requirements, the open decision, and who
> does what, so we can pick it straight back up.

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

## Decision needed
Which path (①, ②, or ③)? Recommendation: **② Cloudflare Tunnel** for a real
installable PWA with the least setup, keeping the AI on the Mac.
