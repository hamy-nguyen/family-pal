# Handoff: Family Pal — Full Flow Redesign

## Overview
A visual redesign of **Family Pal** — the mobile PWA that turns photos of hospital papers into a
searchable family medical-history book. The goal was to make the UI **friendlier, calmer, and
easier to scan**, and to switch the language to **English**.

This package now covers the **entire user flow**, five screens:

1. **Home / record list** — `src/app/page.tsx` (already implemented ✅ — included here as reference)
2. **Capture · add photos** — `src/app/capture/page.tsx` (the photo-attach + "read with AI" step)
3. **AI reading** — a loading state within `capture/page.tsx` (shown while `extracting === true`)
4. **Review & save** — the form half of `capture/page.tsx` (after extraction, before save)
5. **Visit detail** — `src/app/visit/[id]/page.tsx`

> **Home is done.** Screens 2–5 are the new work in this round. The design language (indigo +
> Plus Jakarta Sans + soft cards) is identical to the shipped Home screen — reuse those tokens
> and components.

### Two design files in this bundle
- `Family Pal Home.dc.html` — the Home screen on its own (screen 1).
- `Family Pal Flow.dc.html` — **all five screens** side by side on one canvas (the full flow).
  Open this to see screens 2–5. Pan by dragging the gray background.

### Important: this app has a hybrid capture model
The form is **not** one block of AI output. Per `types.ts`, fields split into two groups:
- **AI-extracted from photos** (`StructuredResult`): `disease_category`, `hospital`,
  `visit_time`, `medicines` — and the model *may* also fill `symptoms`/`treatment`/`cost`/
  `insurance` if printed on the document.
- **User-typed observations**: `symptoms`, `treatment`, `cost`, `insurance` (kept if the user
  already typed them — extraction never overwrites a non-empty field).
The Review screen design reflects this split with an **"Auto-filled"** section (tinted fields)
vs a **"Your notes"** section. Preserve that mental model — it's the core of the product.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and layout, **not production code to copy directly**. The phone bezel, the
`.dc.html` wrapper, `ios-frame.jsx`, and `support.js` are just the harness used to render the
mockup; **ignore them as implementation**. They are only here so you can open the design in a
browser and inspect exact pixels/colors with dev tools.

Your task is to **recreate this design inside the existing Family Pal codebase** — Next.js (App
Router) + React + **Tailwind CSS v4** — using its established patterns (the current
`page.tsx` already has `VisitCard`, `Chip`, the `repo()` data layer, and the `+` capture FAB
wired to the camera). Keep all existing data wiring and behavior; this is a **presentation-layer
restyle plus a grouping change**, not a rewrite.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and component structure are intended as
shown. Recreate pixel-faithfully with Tailwind utilities. Exact hex values, sizes, and radii
are listed in **Design Tokens** below.

## How to view the design
Open `Family Pal Home.dc.html` in a browser (or via the design tool). It renders a single
iPhone-sized frame (402 × 874 logical px) containing the Home screen. Everything inside the
phone is the design; the gray page background and bezel are not.

---

## Screen: Home / Record List

### Purpose
Landing screen. A parent scans the family's recent medical visits, filters by member, searches,
and taps **Add record** to capture a new one.

### Layout (top → bottom)
Single scrolling column, mobile width (designed at 402px, fluid to device width — cap content at
`max-w-md` and center, matching the current app). Vertical order:

1. **Header block** — padding `60px 20px 0` (the 60px top clears the status bar; in the real app
   use safe-area inset instead).
   - Greeting row: left = two stacked lines; right = circular user avatar.
   - Search bar (full width, 16px below greeting).
2. **Family members row** — horizontal scroll, `padding: 20px 20px 4px`, `gap: 18px`.
3. **Toolbar row** — `padding: 16px 20px 6px`, space-between: title + count on left, sort pill on right.
4. **Record list** — `padding: 6px 20px 150px`, vertical `gap: 18px` between month groups.
   - Each **month group** = a small header row (month label + visit count) then cards stacked with `gap: 11px`.
5. **Floating "Add record" button** — pinned near bottom center, overlapping the list (sticky).

### Components

#### 1. Greeting
- Line 1: `"Good morning"` — 13px / weight 600 / color `#9b9aaa`.
- Line 2: `"The Carter Family"` — 23px / weight 800 / color `#1e1b4b` / letter-spacing −0.02em / margin-top 2px.
- (In production, pull the family name from data; greeting can be time-based.)

#### 2. User avatar (top-right)
- 46 × 46px circle, background `#6366f1`, white initial `"S"` 17px/700.
- Shadow: `0 6px 16px rgba(99,102,241,0.35)`.

#### 3. Search bar
- Full width, background `#fff`, border `1px solid #ececf4`, radius 16px, padding `13px 15px`.
- Shadow `0 2px 10px rgba(30,27,75,0.04)`. Flex row, `gap: 11px`.
- Leading search icon (18px, stroke `#a3a2b4`, width 2). Placeholder text: `"Search records, hospitals, medicine"` — 14px/500/`#a3a2b4`.
- This is the live `<input>` in the current app — keep it functional; just restyle.

#### 4. Family member avatars
Horizontal scroll. Each item = vertical stack, `align-items:center`, `gap: 8px`, `flex:none`.
- Avatar circle: **56 × 56px**, white initial/icon 21px/700.
- Name label below: 12.5px. Active = weight 700 color `#1e1b4b`; inactive = weight 500 color `#6b6a7b`.
- **Active member** gets a double ring: `box-shadow: 0 0 0 3px #fff, 0 0 0 5px <memberColor>`.
- First item is **"Everyone"** (the `all` filter): background `#6366f1`, white "people" icon (use the same group/users icon).
- Member avatar background colors (see Member Palette below).
- Wire to the existing `member` filter state + `members` from `repo()`. "Everyone" = `member === "all"`.

#### 5. Toolbar
- Left: `"All records"` 15px/800/`#1e1b4b` (nowrap) + count `"6"` 13px/600/`#a3a2b4`, `gap: 7px`, baseline-aligned.
- Right: **Sort pill** — `#fff`, border `1px solid #ececf4`, radius 999px, padding `7px 12px`, shadow `0 2px 8px rgba(30,27,75,0.04)`. Contains a sliders icon (14px, stroke `#6366f1`) + label `"Newest"` 12.5px/600/`#4b4a5e`. This replaces the three sort chips in the current app — opening it should let the user pick Newest / Type / Hospital (keep the existing `SortKey` logic).

#### 6. Month group header
- Row, space-between, baseline, margin `6px 2px 12px`.
- Left: month label e.g. `"June 2026"` — 13px/800/`#1e1b4b`/letter-spacing 0.01em (nowrap).
- Right: visit count e.g. `"2 visits"` — 11.5px/600/`#a3a2b4` (nowrap).
- **Grouping logic:** sort visits newest-first, then bucket by `created_at` month+year. Render a
  header per bucket. (Only applies when sort = Newest; for Type/Hospital sorts, group by that key
  or drop the headers — your call, but Newest+month-groups is the primary view shown here.)

#### 7. Record card (the key component — replaces current `VisitCard`)
Container: flex row, `align-items:center`, `gap: 13px`, background `#fff`,
border `1px solid #efeef6`, radius **20px**, padding **14px**,
shadow `0 4px 18px rgba(30,27,75,0.05)`. Whole card is a link to `/visit/[id]` (keep
`active:scale-[0.99]` tap feedback).

Three parts left→right:

**a) Category icon tile** — `flex:none`, 48 × 48px, radius 14px, centered 24px stroked icon
(stroke width 1.8, `currentColor`). Background = category tint, icon color = category color
(see Category Palette). The category is derived from `disease_category` — map keywords to a
category, defaulting to a neutral one if unknown.

**b) Content** (`flex:1`, `min-width:0`):
- Title row (space-between, `gap:10px`):
  - Diagnosis title — 15.5px/700/`#1e1b4b`/letter-spacing −0.01em, **truncate** (ellipsis, nowrap). Maps to `disease_category`.
  - Cost — 15px/800/`#1e1b4b`, `flex:none`. Maps to `cost` (prefix `$` shown here; current data is free-text, keep as-is or format).
- Hospital row (margin-top 3px, `gap:5px`): 12px location-pin icon (stroke `#b4b3c2`) + hospital text 13px/500/`#7b7a8a`, truncate. Maps to `hospital`.
- Footer row (margin-top 9px, `gap:9px`, align center):
  - **Member chip**: inline-flex, `gap:6px`, background = member tint, radius 999px, padding `3px 9px 3px 4px`. Contains 18px member-color avatar circle (white initial 10px/700) + member name 12px/600 in member-dark color. Maps to `member_name`.
  - Date — 12.5px/500/`#a3a2b4`. Format `created_at` as `"Mmm D"` (e.g. `"Jun 12"`).

#### 8. Floating "Add record" button
- `position: sticky; bottom: 30px`, horizontally centered, sits over the list (the design uses
  `margin-top:-78px` + a `pointer-events:none` wrapper with `pointer-events:auto` on the button).
  In production, prefer `position: fixed` centered above the safe-area inset.
- Button: background `#6366f1`, radius 999px, padding `15px 24px`, white text 15px/700,
  shadow `0 12px 28px rgba(99,102,241,0.45)`. Flex row `gap:9px`: 20px camera icon + label `"Add record"`.
- **Keep the existing capture behavior**: this is the element that opens the camera file-input and
  routes to `/capture` (the current code uses a hidden `<input type="file" capture="environment">`
  inside a `<label>` — preserve that exact mechanism; iOS only opens the camera on a direct tap).

---

## Interactions & Behavior
- **Member filter**: tapping an avatar sets the active member (existing `member` state). "Everyone"
  clears it. Active avatar shows the double-ring; list filters to that member.
- **Search**: live filter over `disease_category`, `hospital`, `symptoms`, `medicines` (existing logic).
- **Sort pill**: opens sort options (Newest / Type / Hospital — existing `SortKey`). Default Newest.
- **Card tap**: navigate to `/visit/[id]`; `active:scale-[0.99]` press feedback.
- **Add record**: opens camera, stores image to the capture buffer, routes to `/capture` (unchanged).
- **Empty state**: keep the existing "Chưa có bản ghi nào" message, translated to English
  (e.g. "No records yet. Tap + to add one.").
- No new animations beyond existing tap scale. Horizontal member row scrolls; scrollbars hidden.

## State Management
No new global state. Reuses the current screen's state exactly:
- `visits: Visit[]`, `members: Member[]`, `loading: boolean`
- `sort: SortKey`, `member: string` ("all" | member id), `q: string` (search)
- Data via `repo().listVisits()` / `listMembers()` (localStorage or Supabase — unchanged).
- New: a pure derived helper to bucket the filtered+sorted `visits` into month groups for rendering.

## Design Tokens

### Colors — Brand / Neutral
| Token | Hex | Use |
|---|---|---|
| Primary indigo | `#6366f1` | Avatars, FAB, active ring, icon accents |
| Title text (navy) | `#1e1b4b` | Headings, titles, cost |
| Body slate | `#7b7a8a` | Hospital / secondary text |
| Muted slate | `#a3a2b4` | Dates, counts, placeholder |
| Muted slate 2 | `#9b9aaa` | "Good morning" |
| Label slate | `#4b4a5e` / `#6b6a7b` | Sort label / inactive member name |
| Icon hairline | `#b4b3c2` | Location pin icon |
| App background | `#f4f4f9` | Screen background |
| Card background | `#ffffff` | Cards, search, pills |
| Card border | `#efeef6` | Record card border |
| Input border | `#ececf4` | Search + sort pill border |

### Category Palette (icon tile)
| Category | Tint (bg) | Color (icon/text) | Icon |
|---|---|---|---|
| Ear / ENT | `#fdecd8` | `#d97a2b` | ear |
| Fever / cold | `#fde7e9` | `#d6455a` | thermometer |
| Vaccination / check-up | `#e3f4ea` | `#2f9e6f` | shield-check |
| Skin / eczema | `#e1f1f2` | `#2c8f93` | droplet |
| Dental | `#e6effb` | `#3b73c4` | tooth |
| Allergy | `#efe9fb` | `#6d52c4` | leaf |

### Member Palette
| Member | Avatar bg | Chip tint | Chip text |
|---|---|---|---|
| Emma | `#ec4899` | `#fde8f0` | `#be185d` |
| Liam | `#3b82f6` | `#e6f0fe` | `#1d4ed8` |
| Sarah | `#8b5cf6` | `#f1ebfd` | `#6d28d9` |
| Tom | `#0d9488` | (teal tint) | — |
| Everyone (filter) | `#6366f1` | — | — |
> Assign colors to real members deterministically (e.g. by index) so each person keeps a stable color.

### Shadows
| Use | Value |
|---|---|
| Search bar | `0 2px 10px rgba(30,27,75,0.04)` |
| Sort pill | `0 2px 8px rgba(30,27,75,0.04)` |
| Record card | `0 4px 18px rgba(30,27,75,0.05)` |
| User avatar | `0 6px 16px rgba(99,102,241,0.35)` |
| FAB | `0 12px 28px rgba(99,102,241,0.45)` |

### Radii
- Card / search: 16px (search), 20px (card)
- Icon tile: 14px
- Pills / chips / avatars / FAB: 999px (full)

### Typography
- **Font family: Plus Jakarta Sans** (Google Fonts, weights 400/500/600/700/800). Load via
  `next/font/google`. This replaces the current system-font stack.
- Sizes/weights are specified per component above. General scale in use: 11.5, 12, 12.5, 13, 14,
  15, 15.5, 23 px; weights 500/600/700/800.

### Spacing
Screen horizontal padding 20px. Common gaps: 5, 7, 8, 9, 11, 13, 18 px. Card padding 14px.

## Assets
- **No raster assets.** All icons are inline SVGs (24px category icons, plus search / location-pin /
  sliders / users / camera). Reproduce with the codebase's icon set (e.g. **lucide-react**, which
  already has `thermometer`, `shield-check`, `droplet`, `leaf`, `search`, `map-pin`, `sliders`,
  `users`, `camera`; for **ear** and **tooth** use lucide `ear` and `tooth` if available, else the
  inline paths in the HTML). Match stroke width ~1.8 and the colors above.
- **Font:** Plus Jakarta Sans via Google Fonts / `next/font`.

---

# Screen 2 · Capture (add photos)
**File:** `src/app/capture/page.tsx` (the top half — photo attach + extract trigger).
**Replaces:** the `bg-sky-500` header, the two dashed `PhotoSlot`s, and the dark "Trích xuất từ ảnh" button.

### Header (shared across screens 2–4)
- Padding `58px 20px 10px`. Row, `gap:12px`, align center.
- **Back button:** 40×40 circle, `#fff`, border `1px solid #ececf4`, shadow `0 2px 8px rgba(30,27,75,0.04)`, chevron-left icon stroke `#4b4a5e`. Wired to `router.back()`.
- Title block: title 19px/800/`#1e1b4b` letter-spacing −0.02em; subtitle 12.5px/600/`#9b9aaa` below.
  - Screen 2 title `"New record"`, subtitle `"Step 1 of 2 · Add photos"`.

### Body
1. **Intro** (`gap:7px`): uppercase section label `"Snap the paperwork"` (11.5px/700, letter-spacing 0.05em, `#a3a2b4`) + helper line 13.5px/500/`#7b7a8a` line-height 1.5: "Add the exam result and prescription. We'll read them for you."
2. **Two photo slots** — `grid-cols-2`, `gap:13px`, each tile `aspect-ratio:3/4`, radius 16px. Below each, a 12px/600/`#4b4a5e` caption (`"Exam result"`, `"Prescription"`). These map to `examImg` / `rxImg`. Keep the existing hidden `<input type="file" accept="image/*" capture="environment">` inside a `<label>` — that's what opens the camera.
   - **Filled slot** (has image): show the photo `object-cover`. Design shows a placeholder doc + a green check badge top-right (24px circle `#2f9e6f`, white check, shadow `0 2px 8px rgba(47,158,111,.4)`) to signal "attached".
   - **Empty slot:** border `2px dashed #cdd0dd`, bg `#fbfbfe`, centered: 46px rounded-14 tile bg `#eef0fe` with indigo camera icon, + `"Tap to add"` 12.5px/600/`#8d8c9c`.
3. **Primary CTA** — full-width `.primary` button (indigo `#6366f1`, radius 16px, padding 15px, 15px/700 white, shadow `0 10px 24px rgba(99,102,241,.4)`), sparkle icon + **"Read photos with AI"**. This is the existing `extractFrom([examImg, rxImg])` trigger; `disabled` when no photos. While extracting, this screen transitions to **Screen 3**.
4. **Manual fallback row** — a quiet white card (radius 16px, border `#efeef6`): edit icon + "Or fill in the details by hand" 13px/600/`#7b7a8a` + chevron. Lets users skip AI and go straight to the form (Screen 4) — same form, just no auto-fill.

# Screen 3 · AI reading (loading state)
**Where:** rendered inside `capture/page.tsx` while `extracting === true` (currently the button just reads "Đang đọc ảnh…"). Make it a **full friendly loading view** instead of a disabled button, so the wait feels productive.

- Header subtitle becomes `"Reading your photos…"`.
- **Scanning visual:** a tilted (−5°) document placeholder (150×190, shadow `0 12px 30px rgba(30,27,75,.12)`) with a horizontal indigo scan-line (`linear-gradient(90deg,transparent,#6366f1,transparent)`, glow). Decorative.
- **Spinner:** 46px, 4px track `#e6e6f6`, top `#6366f1`, spin 0.9s.
- **Copy:** "Reading your photos" 17px/800 + "Pulling out diagnosis, hospital, date & medicines" 13px/500/`#9b9aaa`.
- **Progress checklist** (3 rows, white cards radius 14px): done rows have a green 22px check circle + 13.5px/600 label (`"Diagnosis found"`, `"Hospital & date"`); the in-progress row pulses (1.4s) with a small spinner + `"Reading prescription…"` 13.5px/600/`#8d8c9c`.
  - This maps to the two real network steps in `extractFrom`: the **OCR** loop (`/api/ocr` per image) then **structure** (`/api/structure`). Drive the checklist off those two awaits — mark "text read" after OCR resolves, "details extracted" after structure resolves. Don't fake granular sub-steps beyond what the code does; two real stages is fine.

# Screen 4 · Review & save
**File:** `src/app/capture/page.tsx` (the form + sticky save). **Replaces** the `Field`/`SectionLabel`/member `<select>` styling and the sticky footer.

- Header title `"Review & save"`, subtitle `"Step 2 of 2 · Check the details"`.
- Body padding `8px 20px 130px` (clears the sticky footer).

1. **Member selector** ("Who is this for?") — replaces the `<select>` with a **horizontal scroll of member pills**. Selected pill = solid member color, white text, white initial-circle. Unselected = white, border `#ececf4`, colored initial-circle, `#4b4a5e` label. Maps to `form.member_id` + `members`.
2. **"From your photos" section** — uppercase label + an **"Auto-filled" badge** (pill bg `#eef0fe`, text `#5457d6`, sparkle icon). Fields below are the AI-extracted ones, styled as **read-back values with a tinted treatment** (border `#dcdef9`, bg `#fbfbff`) so users see what the AI filled: **Diagnosis** (`disease_category`), **Hospital** (`hospital`), **Date** (`visit_time`), **Medicines** (`medicines`). All remain editable `<input>`/`<textarea>` — keep the existing controlled-input wiring; the tint is just a visual signal, not a disabled state.
3. **"Your notes" section** — the user-typed fields on plain white inputs: **Symptoms** (`symptoms`, textarea min-height ~54px), **Cost** (`cost`, `inputMode="numeric"`), **Insurance** (`insurance`). Treatment can join here too.
4. **Field styling** (`.inp`): white, border `#ececf4`, radius 14px, padding `13px 14px`, 14.5px/600/`#1e1b4b`, shadow `0 2px 8px rgba(30,27,75,.03)`. Label (`.flbl`) 12px/600/`#8d8c9c`, 7px below.
5. **Sticky footer Save** — absolute bottom, padding with `env(safe-area-inset-bottom)`, a top fade gradient (`#f4f4f9` → transparent), full-width `.primary` button **"Save record"** 15.5px/700. Wired to existing `save()`. Loading label "Saving…".
   - Keep the existing collapsible **OCR raw-text** `<details>` if you want (style it as a quiet row); optional.

# Screen 5 · Visit detail
**File:** `src/app/visit/[id]/page.tsx`. **Replaces** the `bg-sky-500` header, the flat `Row`/`TextCard`/`ImageCard` list.

- Header: back button (same style) + `"Visit"` title on the left; an **edit pencil** button (same 40px circle) on the right (optional — wire to an edit route if one exists, else omit).
- Body padding `8px 20px 40px`, `gap:16px`. All blocks use the `.card` style (white, border `#efeef6`, radius 20px, shadow `0 4px 18px rgba(30,27,75,.05)`).

1. **Hero card** (padding 20px):
   - Row: 56px rounded-16 **category icon tile** (same category palette as Home, derived from `disease_category`) + diagnosis title 19px/800 letter-spacing −0.02em + formatted date 13px/500/`#9b9aaa` (from `created_at` or `visit_time`).
   - Divider, then: **member chip** (left) + **Total cost** block (right): tiny uppercase "Total cost" label + 20px/800 value (`cost`).
2. **Info table card** (padding `6px 18px`): rows (`.rowln`, 13px between, hairline `#f1f1f7`, last has none) — **Hospital** (`hospital`), **Treatment** (`treatment`), **Insurance** (`insurance`, value can be green `#2f9e6f`). The design also shows a computed **"Out of pocket"** row — only include if you can derive it (cost − insurance); both are free-text today, so treat as optional / skip if not parseable. Each row hidden when its value is empty (keep the existing `if (!value) return null` behavior).
3. **Symptoms card** — uppercase label + `symptoms` text 14px/500/`#4b4a5e` line-height 1.55.
4. **Medicines card** — uppercase label + each medicine as a row: 34px rounded-10 pill-icon tile (`#eef0fe`/`#6366f1`) + name 14px/700 + optional dosage 12.5px/500/`#9b9aaa`. `medicines` is free text today — render it as one row, or split on newlines/commas into multiple rows if you want the richer look. Don't fabricate dosages that aren't in the data.
5. **Attached photos** — uppercase label + `grid-cols-2 gap:12px` of the two photos (`exam_image_url`, `prescription_image_url`), each `aspect-ratio:3/4` rounded-16 with a caption below. Only render slots that have an image. Tapping should open the photo full-screen (lightbox — nice-to-have).

---

## Files in this bundle
- `Family Pal Home.dc.html` — the Home screen design reference (screen 1).
- `Family Pal Flow.dc.html` — **the full five-screen flow** on one canvas (open this for screens 2–5).
- `ios-frame.jsx`, `support.js` — **rendering harness only; not part of the design.** Ignore.

## Target files to change in the real codebase
- `family_pal/src/app/page.tsx` — Home. (Already done ✅ — reference only.)
- `family_pal/src/app/capture/page.tsx` — Screens 2, 3, 4. Restyle header, photo slots, extract
  button → "Read photos with AI"; add the friendly **extracting** loading view; restyle the form
  with the Auto-filled vs Your-notes split, member pills, and sticky save. **Keep all existing
  logic**: `extractFrom`, `/api/ocr` + `/api/structure` calls, the per-field "don't overwrite typed
  values" merge, `pickPhoto`, `save()`, `takePendingImage()`.
- `family_pal/src/app/visit/[id]/page.tsx` — Screen 5. Restyle into hero + cards; keep `repo().getVisit`,
  the empty-field guards, and image rendering. Translate labels to English.
- `family_pal/src/app/globals.css` / Tailwind theme — tokens + Plus Jakarta Sans (shared with Home).

## Localization
All UI copy moves **Vietnamese → English** (headers, field labels, buttons, empty/loading states).
The underlying data is unchanged. Map the existing labels: Bản ghi mới→New record, Ảnh khám→Exam
result, Đơn thuốc→Prescription, Trích xuất từ ảnh→Read photos with AI, Người khám→Who is this for,
Loại bệnh→Diagnosis, Đi khám→Hospital, Thời gian→Date, Thuốc dùng→Medicines, Triệu chứng→Symptoms,
Điều trị→Treatment, Tiền khám + thuốc→Cost, Bảo hiểm→Insurance, Lưu bản ghi→Save record.
