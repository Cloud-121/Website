import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SettingsChangeBanner } from "@/components/settings-change-banner";
import { THEME_INIT_CODE } from "@/components/theme-script";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gulfcoastmesh.org"),
  title: {
    default: "Gulf Coast Mesh — Resilient communications for the entire Gulf Coast",
    template: "%s · Gulf Coast Mesh",
  },
  description:
    "A volunteer mesh-network community serving the US Gulf Coast from South Texas to the Florida Panhandle. Open hardware, decentralized messaging, live maps, and friendly mentorship.",
  openGraph: {
    title: "Gulf Coast Mesh",
    description:
      "A volunteer mesh-network community serving the US Gulf Coast — open hardware, decentralized messaging, live maps.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f9fd" },
    { media: "(prefers-color-scheme: dark)", color: "#03080f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Tell the Dark Reader browser extension to leave this site alone:
          we already implement a designed dark theme (see <ThemeToggle /> +
          tailwind.config.ts gulf/ink/sand palettes), and Dark Reader's
          inversion fights it AND injects DOM attributes pre-hydration that
          trigger React hydration mismatches.
          https://github.com/darkreader/darkreader#how-to-disable-dark-reader-on-some-pages
        */}
        <meta name="darkreader-lock" />
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_CODE}
        </Script>
      </head>
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} bg-canvas relative min-h-screen font-sans text-ink-900 antialiased dark:text-ink-50`}
      >
        <div className="pointer-events-none fixed inset-0 z-0 bg-grid opacity-60 dark:opacity-30" aria-hidden />
        <div className="pointer-events-none fixed inset-0 z-0 bg-noise" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1 pt-28 sm:pt-32">
            <SettingsChangeBanner />
            {children}
          </main>
          <SiteFooter />
        </div>
        <Script
          async
          src="https://static.getclicky.com/js"
          data-id="101506255"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
