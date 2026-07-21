# Family Pal — Core Technology

**Snap a Vietnamese medical document → a structured, searchable family health record.**
The AI runs **on the user's own device** — no document ever touches a third-party AI.

---

## Two on-device engines

### 🖼️ Apple Vision — reading the paper (OCR)
- **Specialized** for text recognition; strong on Vietnamese diacritics
- **On-device** (native macOS) — images never leave the machine
- **Free** — no API, no per-page cost

### 🧠 gemma-4-e4b-it — structuring the data (LLM)
*Roughly a Gemini 3.1 Flash-Lite-class model, running locally via MLX.*
- **Lightweight** — ~4B effective params, fits on a laptop
- **Fast** — a full record structured in seconds
- **Robust** — output constrained to a strict JSON schema, so it *fills a form, it can't invent one* (no hallucinated fields)
- **Free** — local inference, zero API spend

---

## Why it matters

- **Private by architecture** — the two most sensitive steps (raw image + text) run locally; nothing is sent to OpenAI/Google.
- **~Zero marginal cost** — the expensive part of AI (inference) runs on hardware the user already owns.
- **Trustworthy output** — schema-enforced extraction keeps medical fields structured and unfabricated.

## The rest of the stack (thin, cloud, cheap)
Next.js PWA · Supabase (Postgres + RLS + Auth + Storage) · Tailscale Funnel exposes the on-device AI. All free-tier.

---

*Soundbite:* **"The AI runs on your device, not our servers — your medical records never leave your hands."**
