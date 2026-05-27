/**
 * Server-only fetcher for the Gulf Coast Mesh Monitor public API.
 *
 * Source: https://meshbuddy.gulfcoastmesh.org/api/*
 * Contract: see API.md and openapi.yaml in the repo root.
 *
 * Reports responses can be slow on a cold cache (~5 min TTL upstream).
 * We mirror lib/mesh-stats.ts with a 5-minute revalidate window.
 */

import "server-only";

import { meshMonitorApiOrigin, safeMapUrl } from "@/lib/mesh-monitor-proxy";

export const MESH_MONITOR_API_BASE = meshMonitorApiOrigin();

const REVALIDATE_SECONDS = 300;

export type ReportRepeaterLocation = {
  text: string;
  map_url: string | null;
};

export type ReportRepeaterRow = {
  name: string;
  prefix: string;
  public_key: string;
  first_seen?: string;
  last_seen: string;
  location: ReportRepeaterLocation;
  owner: string | null;
  advert_count: number | null;
  clock_skew_seconds: number | null;
  clock_sync: string | null;
  clock_sync_label: string;
  region: string;
};

export type NetworkReport = {
  timestamp: string;
  config: { active_days: number; prefix_length: number };
  summary: {
    total_nodes: number;
    repeaters: number;
    companions: number;
    needs_attention: number;
    recently_active: number;
  };
  no_location: { count: number; repeaters: ReportRepeaterRow[] };
  clock_sync: {
    source: string;
    fetched: number;
    missing: number;
    ok: number;
    minor: number;
    out_of_sync: number;
    unknown: number;
    repeaters: ReportRepeaterRow[];
  };
};

export type DuplicateNode = {
  name: string;
  public_key: string;
  last_seen: string;
};

export type DuplicateGroup = {
  prefix: string;
  count: number;
  nodes: DuplicateNode[];
};

export type DuplicatesResponse = {
  timestamp: string;
  count: number;
  duplicates: DuplicateGroup[];
};

export type MonitorStatus = {
  status: string;
  timestamp: string;
  prefix_length: number;
  mesh_map_url: string;
  website_url: string | null;
  reports: { active_days: number };
};

const EMPTY_REPORT: NetworkReport = {
  timestamp: "",
  config: { active_days: 14, prefix_length: 4 },
  summary: {
    total_nodes: 0,
    repeaters: 0,
    companions: 0,
    needs_attention: 0,
    recently_active: 0,
  },
  no_location: { count: 0, repeaters: [] },
  clock_sync: {
    source: "",
    fetched: 0,
    missing: 0,
    ok: 0,
    minor: 0,
    out_of_sync: 0,
    unknown: 0,
    repeaters: [],
  },
};

function normalizeRepeaterRow(raw: unknown): ReportRepeaterRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || typeof r.prefix !== "string") return null;
  const loc = r.location as Record<string, unknown> | undefined;
  return {
    name: r.name,
    prefix: r.prefix,
    public_key: typeof r.public_key === "string" ? r.public_key : "",
    first_seen: typeof r.first_seen === "string" ? r.first_seen : undefined,
    last_seen: typeof r.last_seen === "string" ? r.last_seen : "",
    location: {
      text: typeof loc?.text === "string" ? loc.text : "—",
      map_url: safeMapUrl(typeof loc?.map_url === "string" ? loc.map_url : null),
    },
    owner: typeof r.owner === "string" ? r.owner : null,
    advert_count: typeof r.advert_count === "number" ? r.advert_count : null,
    clock_skew_seconds:
      typeof r.clock_skew_seconds === "number" ? r.clock_skew_seconds : null,
    clock_sync: typeof r.clock_sync === "string" ? r.clock_sync : null,
    clock_sync_label:
      typeof r.clock_sync_label === "string" ? r.clock_sync_label : "",
    region: typeof r.region === "string" ? r.region : "",
  };
}

function normalizeReport(json: unknown): NetworkReport {
  if (!json || typeof json !== "object") return EMPTY_REPORT;
  const d = json as Record<string, unknown>;
  const summary = (d.summary ?? {}) as Record<string, unknown>;
  const config = (d.config ?? {}) as Record<string, unknown>;
  const noLoc = (d.no_location ?? {}) as Record<string, unknown>;
  const clock = (d.clock_sync ?? {}) as Record<string, unknown>;

  const noLocRows = Array.isArray(noLoc.repeaters)
    ? noLoc.repeaters.map(normalizeRepeaterRow).filter((r): r is ReportRepeaterRow => r !== null)
    : [];
  const clockRows = Array.isArray(clock.repeaters)
    ? clock.repeaters.map(normalizeRepeaterRow).filter((r): r is ReportRepeaterRow => r !== null)
    : [];

  return {
    timestamp: typeof d.timestamp === "string" ? d.timestamp : "",
    config: {
      active_days: typeof config.active_days === "number" ? config.active_days : 14,
      prefix_length: typeof config.prefix_length === "number" ? config.prefix_length : 4,
    },
    summary: {
      total_nodes: typeof summary.total_nodes === "number" ? summary.total_nodes : 0,
      repeaters: typeof summary.repeaters === "number" ? summary.repeaters : 0,
      companions: typeof summary.companions === "number" ? summary.companions : 0,
      needs_attention:
        typeof summary.needs_attention === "number" ? summary.needs_attention : 0,
      recently_active:
        typeof summary.recently_active === "number" ? summary.recently_active : 0,
    },
    no_location: {
      count: typeof noLoc.count === "number" ? noLoc.count : noLocRows.length,
      repeaters: noLocRows,
    },
    clock_sync: {
      source: typeof clock.source === "string" ? clock.source : "",
      fetched: typeof clock.fetched === "number" ? clock.fetched : 0,
      missing: typeof clock.missing === "number" ? clock.missing : 0,
      ok: typeof clock.ok === "number" ? clock.ok : 0,
      minor: typeof clock.minor === "number" ? clock.minor : 0,
      out_of_sync: typeof clock.out_of_sync === "number" ? clock.out_of_sync : 0,
      unknown: typeof clock.unknown === "number" ? clock.unknown : 0,
      repeaters: clockRows,
    },
  };
}

export async function getNetworkReport(): Promise<{ ok: boolean; report: NetworkReport }> {
  try {
    const res = await fetch(`${MESH_MONITOR_API_BASE}/api/reports`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["mesh-monitor", "reports"] },
    });
    if (!res.ok) return { ok: false, report: EMPTY_REPORT };
    const json = await res.json();
    return { ok: true, report: normalizeReport(json) };
  } catch {
    return { ok: false, report: EMPTY_REPORT };
  }
}

export async function getDuplicates(): Promise<{ ok: boolean; data: DuplicatesResponse }> {
  const empty: DuplicatesResponse = { timestamp: "", count: 0, duplicates: [] };
  try {
    const res = await fetch(`${MESH_MONITOR_API_BASE}/api/duplicates`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["mesh-monitor", "duplicates"] },
    });
    if (!res.ok) return { ok: false, data: empty };
    const json = (await res.json()) as Record<string, unknown>;
    const duplicates = Array.isArray(json.duplicates)
      ? json.duplicates
          .map((g): DuplicateGroup | null => {
            if (!g || typeof g !== "object") return null;
            const row = g as Record<string, unknown>;
            const nodes = Array.isArray(row.nodes)
              ? row.nodes
                  .map((n): DuplicateNode | null => {
                    if (!n || typeof n !== "object") return null;
                    const node = n as Record<string, unknown>;
                    if (typeof node.name !== "string") return null;
                    return {
                      name: node.name,
                      public_key:
                        typeof node.public_key === "string" ? node.public_key : "",
                      last_seen:
                        typeof node.last_seen === "string" ? node.last_seen : "",
                    };
                  })
                  .filter((n): n is DuplicateNode => n !== null)
              : [];
            if (typeof row.prefix !== "string") return null;
            return {
              prefix: row.prefix,
              count: typeof row.count === "number" ? row.count : nodes.length,
              nodes,
            };
          })
          .filter((g): g is DuplicateGroup => g !== null)
      : [];
    return {
      ok: true,
      data: {
        timestamp: typeof json.timestamp === "string" ? json.timestamp : "",
        count: typeof json.count === "number" ? json.count : duplicates.length,
        duplicates,
      },
    };
  } catch {
    return { ok: false, data: empty };
  }
}

export async function getMonitorStatus(): Promise<MonitorStatus | null> {
  try {
    const res = await fetch(`${MESH_MONITOR_API_BASE}/api/status`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["mesh-monitor", "status"] },
    });
    if (!res.ok) return null;
    return (await res.json()) as MonitorStatus;
  } catch {
    return null;
  }
}

/** Pretty-format integers for stat tiles. */
export function fmtCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return n.toLocaleString("en-US");
}

/** Format ISO timestamps for table cells (local short date + time). */
export function formatSeenAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Human-readable clock skew for operator-facing tables. */
export function formatClockSkew(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.abs(seconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function clockBadgeClass(sync: string | null): string {
  switch (sync) {
    case "minor":
      return "bg-sand-400/20 text-sand-800 dark:text-sand-200";
    case "out_of_sync":
      return "bg-coral-500/15 text-coral-800 dark:text-coral-200";
    default:
      return "bg-ink-200/60 text-ink-700 dark:bg-white/10 dark:text-ink-200";
  }
}
