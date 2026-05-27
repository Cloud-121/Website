import Link from "next/link";
import {
  Antenna,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  Coffee,
  Compass,
  Cpu,
  Github,
  Hammer,
  Hash,
  Heart,
  Key,
  Map as MapIcon,
  MessageSquare,
  Radar,
  Radio,
  Router,
  Settings2,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";

export const metadata = {
  title: "Resources",
  description:
    "Gulf Coast Mesh guides, Meshtastic upstream tools, and ways to support the community.",
};

type Resource = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  accent: string;
  // When true, the card renders as a Next <Link> for client-side navigation
  // instead of an external anchor with target="_blank".
  internal?: boolean;
};

const guides: Resource[] = [
  {
    title: "MeshCore frequency settings",
    description: "How to switch your radio to the Gulf Coast Mesh frequency settings used across Louisiana.",
    href: "/docs/freq-settings",
    internal: true,
    icon: Settings2,
    tag: "Required reading",
    accent: "from-gulf-400/25 to-gulf-600/10",
  },
  {
    title: "Louisiana channels",
    description: "Channel layout the local network runs on — primary, secondary, and special-purpose.",
    href: "/docs/channels",
    internal: true,
    icon: Hash,
    tag: "Config",
    accent: "from-sky-400/25 to-gulf-500/10",
  },
  {
    title: "Recommended devices",
    description: "Shopping list for your first Meshtastic / MeshCore radio — and good upgrade picks.",
    href: "/docs/devicerecs",
    internal: true,
    icon: Cpu,
    tag: "Buy",
    accent: "from-violet-400/25 to-gulf-500/10",
  },
  {
    title: "Antenna guide",
    description: "Which antenna to use for handhelds, base stations, and repeater builds.",
    href: "/docs/antenna",
    internal: true,
    icon: Antenna,
    tag: "RF",
    accent: "from-emerald-400/25 to-gulf-500/10",
  },
  {
    title: "MeshCore companion setup",
    description: "Set up a MeshCore device for daily carry — paired with your phone.",
    href: "/docs/setting-up-meshcore-companion",
    internal: true,
    icon: Smartphone,
    tag: "Guide",
    accent: "from-sand-400/25 to-gulf-500/10",
  },
  {
    title: "MeshCore repeater setup",
    description: "Build a repeater node to help extend the network across the coast.",
    href: "/docs/meshcore-repeater-setup",
    internal: true,
    icon: Router,
    tag: "Guide",
    accent: "from-fuchsia-400/25 to-gulf-500/10",
  },
  {
    title: "Mesh monitoring & reserve",
    description: "Reserve a repeater prefix, check duplicates, and view network health reports.",
    href: "/mesh-monitor",
    internal: true,
    icon: Radio,
    tag: "Operator",
    accent: "from-gulf-400/25 to-sand-500/10",
  },
];

const deepDives: Resource[] = [
  {
    title: "DIY repeater builds",
    description: "Reference designs and parts lists for community-built repeaters.",
    href: "/docs/diy-repeater-builds",
    internal: true,
    icon: Hammer,
    tag: "Build",
    accent: "from-sand-400/25 to-coral-500/10",
  },
  {
    title: "Estimate coverage with Meshmapper",
    description: "Predict how far a node will reach before you climb the tower.",
    href: "/docs/estimate-coverage-with-meshmapper",
    internal: true,
    icon: Radar,
    tag: "Planning",
    accent: "from-emerald-400/25 to-gulf-500/10",
  },
  {
    title: "Change a repeater public key",
    description: "Rotate a MeshCore repeater key without losing your spot on the network.",
    href: "/docs/change-repeater-public-key",
    internal: true,
    icon: Key,
    tag: "Advanced",
    accent: "from-violet-400/25 to-gulf-500/10",
  },
  {
    title: "Community transparency",
    description: "How the project operates, who runs it, and where the money goes.",
    href: "/docs/transparency",
    internal: true,
    icon: ShieldCheck,
    tag: "About",
    accent: "from-ink-400/25 to-gulf-500/10",
  },
];

const community: Resource[] = [
  {
    title: "Discord",
    description:
      "Real-time chat plus our weekly Monday voice meeting — the fastest way to get help and meet operators.",
    href: "https://discord.gulfcoastmesh.org",
    icon: MessageSquare,
    tag: "Community",
    accent: "from-indigo-400/25 to-gulf-500/10",
  },
  {
    title: "GitHub",
    description: "Source code for the website, docs, and supporting tooling — patches welcome.",
    href: "https://github.com/GulfCoastMesh",
    icon: Github,
    tag: "Open source",
    accent: "from-ink-400/25 to-gulf-500/10",
  },
  {
    title: "Support on Ko-fi",
    description: "Antennas, tower fees, and repeater hardware aren’t free — chip in if you can. Every coffee helps keep the mesh on the air.",
    href: "https://ko-fi.com/gulfcoastmesh",
    icon: Coffee,
    tag: "Support",
    accent: "from-coral-400/25 to-sand-500/10",
  },
];

const upstream: Resource[] = [
  {
    title: "Meshtastic.org",
    description: "The official home of the Meshtastic project — firmware, clients, and community hubs.",
    href: "https://meshtastic.org/",
    icon: Radio,
    tag: "Upstream",
    accent: "from-gulf-400/25 to-gulf-600/10",
  },
  {
    title: "Meshtastic web flasher",
    description: "Flash Meshtastic firmware from your browser — no toolchain required.",
    href: "https://github.com/meshtastic/web-flasher",
    icon: Wrench,
    tag: "Tool",
    accent: "from-sky-400/25 to-gulf-500/10",
  },
  {
    title: "Meshtastic docs",
    description: "Setup guides, advanced features, and troubleshooting straight from upstream.",
    href: "https://docs.meshtastic.org/",
    icon: BookOpen,
    tag: "Docs",
    accent: "from-violet-400/25 to-gulf-500/10",
  },
];

export default function LinksPage() {
  return (
    <div className="container pb-24">
      <header className="mx-auto max-w-2xl text-center">
        <span className="eyebrow mx-auto">
          <Compass className="h-3.5 w-3.5" aria-hidden />
          Resources
        </span>
        <h1 className="mt-5 font-display text-display-xl font-semibold tracking-tight text-balance text-ink-900 dark:text-white">
          Gulf Coast toolkit.
        </h1>
        <p className="mt-5 text-pretty text-lg text-ink-600 dark:text-ink-300">
          Our own field guides for getting on the mesh, plus the upstream Meshtastic resources and the places we hang
          out as a community.
        </p>

        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs text-ink-600 dark:border-white/10 dark:text-ink-300"
             style={{ borderColor: "rgb(var(--line) / 0.7)" }}>
          <CalendarCheck className="h-3.5 w-3.5 text-gulf-600 dark:text-gulf-300" />
          Weekly Monday voice net on
          <a
            href="https://discord.gulfcoastmesh.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gulf-700 hover:underline dark:text-gulf-300"
          >
            Discord
          </a>
          — everyone welcome.
        </div>
      </header>

      {/* GULF COAST GUIDES */}
      <Section
        title="Gulf Coast guides"
        kicker="Written and maintained by the community"
        kickerIcon={MapIcon}
      >
        <Grid items={guides} columns="lg:grid-cols-3" />
      </Section>

      {/* DEEP DIVES */}
      <Section
        title="Deeper dives"
        kicker="For when you’re ready to tinker"
        kickerIcon={Hammer}
      >
        <Grid items={deepDives} columns="lg:grid-cols-4" />
      </Section>

      {/* COMMUNITY */}
      <Section title="Community" kicker="Where we hang out" kickerIcon={Heart}>
        <Grid items={community} columns="lg:grid-cols-3" />
      </Section>

      {/* UPSTREAM */}
      <Section title="Upstream & tooling" kicker="The wider Meshtastic / MeshCore world" kickerIcon={BookOpen}>
        <Grid items={upstream} columns="lg:grid-cols-3" />
      </Section>

      <p className="mt-16 text-center text-sm text-ink-500 dark:text-ink-400">
        <Link href="/" className="font-medium text-gulf-700 hover:underline dark:text-gulf-300">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

function Section({
  title,
  kicker,
  kickerIcon: KickerIcon,
  children,
}: {
  title: string;
  kicker: string;
  kickerIcon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gulf-700 dark:text-gulf-300">
            <KickerIcon className="h-3.5 w-3.5" aria-hidden />
            {kicker}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl dark:text-white">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ items, columns = "lg:grid-cols-3" }: { items: Resource[]; columns?: string }) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${columns}`}>
      {items.map((it) => {
        const cardClass = "tile tile-accent group flex h-full flex-col justify-between";
        const inner = (
          <>
            <div>
              <div className={`pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br ${it.accent} opacity-70`} />
              <div className="relative flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-gulf-700 dark:bg-white/5 dark:text-gulf-300">
                  <it.icon className="h-6 w-6" />
                </span>
                <span
                  className="rounded-full border bg-white/70 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-700 dark:border-white/10 dark:bg-white/5 dark:text-ink-100"
                  style={{ borderColor: "rgb(var(--line) / 0.7)" }}
                >
                  {it.tag}
                </span>
              </div>
              <h3 className="relative mt-5 font-display text-lg font-semibold text-ink-900 dark:text-white">
                {it.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{it.description}</p>
            </div>
            <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gulf-700 dark:text-gulf-300">
              {it.internal ? "Open" : "Visit"}
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </span>
          </>
        );

        return it.internal ? (
          <Link key={it.title} href={it.href} className={cardClass}>
            {inner}
          </Link>
        ) : (
          <a
            key={it.title}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cardClass}
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}
