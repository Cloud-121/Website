# Gulf Coast Mesh — Website

A modern, sleek marketing/info site for the Gulf Coast Mesh community. Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind v3**, and **TypeScript 5**.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack (default in Next 16) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
app/
  layout.tsx          Root layout: fonts, theme bootstrap, header, footer
  page.tsx            Homepage (hero, stats, bento features, protocols, steps, CTA)
  meshmap/page.tsx    Live maps + MQTT instructions
  links/page.tsx      Curated resources
  emailsignup/page.tsx Newsletter signup (Listmonk)
  globals.css         Design tokens, surface/utility classes
  icon.svg            Browser tab icon
components/
  site-header.tsx     Floating glass nav with theme toggle
  site-footer.tsx     Multi-column footer with supporters/partners
  theme-toggle.tsx    Light/dark switcher
  theme-script.tsx    Inline pre-paint script (no FOUC)
  coast-mesh.tsx      Stylized animated Gulf Coast SVG (nodes + edges)
lib/
  theme.ts            useTheme hook with localStorage persistence
tailwind.config.ts    Design tokens (gulf, sand, ink palettes; display sizes)
eslint.config.mjs     Flat ESLint config wrapping next/core-web-vitals + next/typescript
```

## Design language

- **Type**: Inter (UI), Space Grotesk (display), JetBrains Mono (eyebrows / monospace details).
- **Color**: deep ink navy, vibrant gulf teal/cyan, warm sand amber, coral accents.
- **Surfaces**: subtle glass cards (`.surface`, `.surface-strong`, `.tile`, `.tile-accent`).
- **Motion**: pre-paint theme bootstrap (no flash), gentle hover lifts, animated SVG pulses on the coast map.
- **Accessibility**: focus rings, `prefers-reduced-motion` honored, semantic landmarks.

## Replacing content

- Update list IDs for newsletter in `app/emailsignup/page.tsx`.
- Update supporters/partners in `components/site-footer.tsx`.
- Update copy and stats in `app/page.tsx`.
