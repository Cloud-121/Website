# Gulf Coast Mesh — rebuild notes

Snapshot of what was done in this session. The whole `development/` tree was
built from scratch — none of the original repo's source code is reused.

## Quick start

```bash
cd development
npm install
npm run dev        # http://localhost:3000
npm run lint       # zero-warning gate
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

`npm install`, `npm run lint`, `npm run typecheck`, and `npm run build` all
exit cleanly with no warnings.

The only npm noise you may still see is `npm warn Unknown env config "devdir"`,
which comes from Cursor's sandbox env, not the project. It won't appear in a
normal terminal.

## Stack

| Layer        | Choice                                           |
| ------------ | ------------------------------------------------ |
| Framework    | **Next.js 16** (App Router, RSC, ISR)            |
| UI           | **React 19**                                     |
| Styling      | **Tailwind CSS 3.4** + CSS custom properties     |
| Language     | **TypeScript 5.7**                               |
| Linter       | **ESLint 9** (flat config, native `eslint-config-next` exports) |
| Icons        | `lucide-react`                                   |
| Fonts        | Inter (body), Space Grotesk (display), JetBrains Mono (mono) |
| Node engine  | `>=20.9.0`                                       |

## Design language

Defined in `tailwind.config.ts` + `app/globals.css`.

- **Palettes**: `ink` (neutrals), `gulf` (primary blue), `sand` (accent warm),
  `coral` (alert/accent).
- **Theme variables**: `--bg`, `--bg-elevated`, `--fg`, `--muted`, `--line`,
  `--accent`. Light + dark modes are real, not just a class swap — every
  surface reads from these vars.
- **Background layers**: `bg-canvas` (radial wash) + `bg-grid` (subtle grid)
  + `bg-noise` (svg grain) stacked behind everything.
- **Components**: `surface`, `shell` (glass panel), `btn-primary` /
  `btn-ghost`, `pill`, `hairline`. Custom animations: `fade-up`, `pulse-ring`,
  `drift`, `shimmer`.
- **Typography**: `font-display` for headings (Space Grotesk), `font-sans`
  body, `font-mono` for kickers/labels.

## Pages

| Route           | What it is                                                |
| --------------- | --------------------------------------------------------- |
| `/`             | Homepage: live-stats hero, embedded explorer map, regions, "how it works", CTA |
| `/meshmap`      | Two embedded live maps (Explorer + Meshview) + MQTT setup |
| `/links`        | Curated docs/community/upstream resources                 |
| `/emailsignup`  | Newsletter signup                                         |

`app/icon.svg` ships as the favicon.

## Live data

`lib/mesh-stats.ts` is a server-only module that:

- Fetches `https://explorer.gulfcoastmesh.org/api/nodes` and `/stats`.
- Buckets nodes by US state (LA/MS/AL/FL/TX), separates active vs total, and
  reports a top routers count.
- Wraps both in `revalidate: 300` (ISR, 5 minutes) with safe fallbacks if
  either endpoint blips.

It exports `getMeshStats()` and a small `fmt()` formatter. The homepage and
regions strip consume it. If the upstream API is unreachable at build/render
time the page degrades to copy-only ("Live on the bayou") instead of fake
numbers.

## Embedded maps

`components/live-map.tsx` is a reusable iframe wrapper with:

- Loading skeleton + animated compass spinner.
- `onError` fallback that points to an "Open in new tab" CTA so the page
  never gets stuck showing a dead white square.
- Configurable `aspect` so we can use a tall hero embed (16/11) and wider
  full-page embeds (2/1) on `/meshmap`.

Embeds used:

- `https://explorer.gulfcoastmesh.org/` on `/` and `/meshmap`.
- `https://meshview.gulfcoastmesh.org/chat` on `/meshmap`.

Both are confirmed not to send `X-Frame-Options: DENY`.

## Theme handling

- `lib/theme.ts` exposes `useTheme()`. Internally it uses
  `useSyncExternalStore` so React 19 doesn't yell about `setState` in
  `useEffect`. It subscribes to `localStorage` (cross-tab sync) and the
  `prefers-color-scheme` media query.
- `components/theme-script.tsx` is the inline script that runs before paint
  to apply the right `light` / `dark` class on `<html>`, killing FOUC.
- `components/site-header.tsx` exposes the sun/moon toggle.

## Tooling fixes that took real work

1. **`next lint` is gone in Next 16** — replaced with
   `eslint . --max-warnings 0` in `package.json`.
2. **ESLint 9 flat config + `eslint-config-next`** — `FlatCompat` choked with
   a circular-JSON error. Fixed by importing the native flat entries directly:
   ```js
   import next from "eslint-config-next";
   import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
   import nextTypescript from "eslint-config-next/typescript";
   ```
3. **`tsconfig.json`** explicitly pins `"jsx": "react-jsx"` so Next stops
   rewriting it on every build.
4. **`npm audit`** shows transitive `postcss` advisories from inside
   `next`'s dep tree. Not directly fixable from here; ride out the next Next
   patch.

## Footer / nav / branding

- New SVG mark used in both the header and footer (rounded ring + signal arc).
- Footer now links to **Live maps**, **Resources**, **Newsletter**, and
  **Transparency** (`docs.gulfcoastmesh.org/transparency/`).
- Contact text, Heltec partner logo, Ko-fi support link all preserved from
  the original site.

## Honesty edits

User asked specifically to stop overselling the network. Done:

- Hero eyebrow now reads `"<N> nodes live · expanding the Gulf"` (real count
  from explorer API), instead of pretending coverage exists everywhere.
- Regions strip shows a real count for LA and `Coming soon` for MS/AL/FL/TX.
- "How it works" links to actual docs.gulfcoastmesh.org pages instead of
  generic placeholders.
- Footer / hero CTAs mention the **Weekly Monday voice net on Discord** so
  the next-step is concrete, not vague "join the community".

## Things I didn't touch (decisions to make later)

- **Meshview node count**: explorer's API gives us numbers, but meshview has
  its own user list at `/chat`. Not currently fetched. Could be added to
  `lib/mesh-stats.ts` if you want a "Meshview users online: N" stat.
- **`/emailsignup`** — kept as a styled shell. There's no backing service
  wired up; whoever owns the mail list (Mailchimp / Buttondown / etc.) needs
  to drop in the form action.
- **Open Graph image** — `app/icon.svg` is the favicon; no `opengraph-image`
  is generated. Easy add later.
- **`Current/`** (the original site at the repo root) was **not** modified.
  Only `package.json` / `package-lock.json` / `tsconfig.json` show in
  `git status` from the original session's `npm install`.

## File map of the new app

```
development/
├─ app/
│  ├─ emailsignup/page.tsx
│  ├─ links/page.tsx
│  ├─ meshmap/page.tsx
│  ├─ globals.css
│  ├─ icon.svg
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ live-map.tsx
│  ├─ site-footer.tsx
│  ├─ site-header.tsx
│  └─ theme-script.tsx
├─ lib/
│  ├─ mesh-stats.ts
│  └─ theme.ts
├─ public/  (static assets if/when needed)
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
├─ README.md
└─ NOTES.md   ← you are here
```
