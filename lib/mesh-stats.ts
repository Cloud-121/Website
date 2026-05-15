/**
 * Live data fetched from the Gulf Coast Mesh Explorer API.
 *
 * Sources:
 *   - https://explorer.gulfcoastmesh.org/api/nodes
 *   - https://explorer.gulfcoastmesh.org/stats
 *
 * Both endpoints are public, return JSON, and are safe to revalidate
 * periodically. We cache for 5 minutes (the Explorer's own
 * "MQTT online" window) to keep things fresh without hammering the
 * upstream service.
 */

const NODES_URL = "https://explorer.gulfcoastmesh.org/api/nodes";
const STATS_URL = "https://explorer.gulfcoastmesh.org/stats";
const REVALIDATE_SECONDS = 300;

/** Rough lat/lon → US Gulf-coast state buckets. */
export type StateCode = "TX" | "LA" | "MS" | "AL" | "FL";

function bucket(lat: number, lon: number): StateCode | "other" {
  if (lat >= 25.0 && lat <= 30.0 && lon >= -98.0 && lon <= -93.5) return "TX";
  if (lat >= 28.9 && lat <= 33.0 && lon >= -94.0 && lon <= -88.85) return "LA";
  if (lat >= 30.0 && lat <= 35.0 && lon >= -91.7 && lon < -88.0 && lon > -88.85) return "MS";
  if (lat >= 30.0 && lat <= 35.0 && lon >= -88.5 && lon <= -87.0) return "AL";
  if (lat >= 30.0 && lat <= 31.5 && lon >= -87.6 && lon <= -82.0) return "FL";
  return "other";
}

type ApiNode = {
  public_key: string;
  name?: string;
  role?: "repeater" | "companion" | "room" | string;
  lat?: number;
  lon?: number;
  last_seen_ts?: number;
};

type ApiNodesResponse = {
  server_time: number;
  data: ApiNode[];
};

type ApiStatsResponse = {
  mapped_devices?: number;
  seen_devices?: number;
  history_edge_count?: number;
  route_count?: number;
  stats?: { last_rx_ts?: number };
};

export type MeshStats = {
  ok: boolean;
  fetchedAt: number;
  serverTime: number | null;
  lastRxAt: number | null;

  totalMapped: number;
  totalSeen: number;
  repeaters: number;
  companions: number;
  rooms: number;
  activeLast24h: number;
  onlineNow: number;
  historyEdges: number;

  byState: Record<StateCode | "other", number>;
};

const FALLBACK: MeshStats = {
  ok: false,
  fetchedAt: 0,
  serverTime: null,
  lastRxAt: null,
  totalMapped: 0,
  totalSeen: 0,
  repeaters: 0,
  companions: 0,
  rooms: 0,
  activeLast24h: 0,
  onlineNow: 0,
  historyEdges: 0,
  byState: { TX: 0, LA: 0, MS: 0, AL: 0, FL: 0, other: 0 },
};

export async function getMeshStats(): Promise<MeshStats> {
  try {
    const [nodesRes, statsRes] = await Promise.all([
      fetch(NODES_URL, { next: { revalidate: REVALIDATE_SECONDS } }),
      fetch(STATS_URL, { next: { revalidate: REVALIDATE_SECONDS } }),
    ]);
    if (!nodesRes.ok || !statsRes.ok) return FALLBACK;
    const nodesJson = (await nodesRes.json()) as ApiNodesResponse;
    const statsJson = (await statsRes.json()) as ApiStatsResponse;

    const serverTime = nodesJson.server_time ?? Date.now() / 1000;
    const nodes = Array.isArray(nodesJson.data) ? nodesJson.data : [];

    const byState: MeshStats["byState"] = { TX: 0, LA: 0, MS: 0, AL: 0, FL: 0, other: 0 };
    let repeaters = 0;
    let companions = 0;
    let rooms = 0;
    let activeLast24h = 0;
    let onlineNow = 0;

    for (const n of nodes) {
      if (typeof n.lat === "number" && typeof n.lon === "number") {
        byState[bucket(n.lat, n.lon)]++;
      }
      if (n.role === "repeater") repeaters++;
      else if (n.role === "companion") companions++;
      else if (n.role === "room") rooms++;
      if (typeof n.last_seen_ts === "number") {
        const delta = serverTime - n.last_seen_ts;
        if (delta < 86400) activeLast24h++;
        if (delta < 300) onlineNow++;
      }
    }

    return {
      ok: true,
      fetchedAt: Date.now(),
      serverTime,
      lastRxAt: statsJson.stats?.last_rx_ts ?? null,
      totalMapped: statsJson.mapped_devices ?? nodes.length,
      totalSeen: statsJson.seen_devices ?? nodes.length,
      repeaters,
      companions,
      rooms,
      activeLast24h,
      onlineNow,
      historyEdges: statsJson.history_edge_count ?? 0,
      byState,
    };
  } catch {
    return FALLBACK;
  }
}

/** Pretty-format numbers for stat tiles, with a `+` for upper estimates. */
export function fmt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-US");
}
