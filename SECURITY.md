# Security Policy

Thanks for helping keep Gulf Coast Mesh and its users safe. We take security
issues seriously, and we appreciate responsible disclosure.

## Supported scope

This policy covers:

- The website source in this repository (`gulfcoastmesh.org`).
- The static assets it serves (firmware binaries, images, JS/CSS).

Out of scope (please report directly to the upstream project):

- Meshtastic firmware / clients — see [meshtastic.org](https://meshtastic.org).
- MeshCore firmware — see the MeshCore project.
- Third-party services we link to or embed (Listmonk, OpenStreetMap, Clicky,
  the Gulf Coast Explorer, etc.).

## Reporting a vulnerability

Please **do not** open a public GitHub issue, post in Discord, or share details
on social media until the issue has been resolved.

Preferred channels, in order:

1. **GitHub Security Advisory** — open a private advisory at
   <https://github.com/GulfCoastMesh/GulfcoastMeshWebsite/security/advisories/new>.
   This keeps the report private and lets us collaborate on a fix.
2. **Direct message** an operator in our
   [Discord](https://discord.gulfcoastmesh.org) — ask for an admin and we'll
   move to a private channel.

When reporting, please include:

- A clear description of the issue and its impact.
- Steps to reproduce (URL, payload, request headers, browser/version).
- Any proof-of-concept code or screenshots.
- Your name / handle if you'd like to be credited in the fix.

## Our commitments

- We will acknowledge your report within **5 business days**.
- We will keep you informed of remediation progress.
- We will credit you in the release notes (or keep you anonymous if you
  prefer).
- We will not pursue legal action against good-faith researchers who follow
  this policy.

## What counts as a vulnerability

Examples we want to hear about:

- Cross-site scripting (XSS) of any flavor, especially via the docs renderer.
- Clickjacking or framing of pages we did not intend to be embedded.
- Content-Security-Policy / security-header bypasses.
- Supply-chain issues (typosquats, malicious lockfile entries, poisoned
  upstream packages).
- Open redirects, SSRF via the Next.js image optimizer, or any way to
  exfiltrate user data.
- Tampering with the firmware payloads served from `/firmware/...`.

What we generally **don't** consider vulnerabilities:

- Missing best-practice headers on third-party origins we don't control.
- Reports from automated scanners with no demonstrated impact.
- Self-XSS, social-engineering, or attacks requiring physical access to the
  user's device.
- Tracker / analytics being blocked by users' browser shields (this is
  expected).

Thanks again — community-run mesh networks only work because people look out
for each other.
