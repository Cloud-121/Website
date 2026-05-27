/**
 * Server-only fetcher for the Gulf Coast Mesh published meeting archive.
 *
 * Source: https://meeting.gulfcoastmesh.org/api/public/meetings
 * Contract: see PUBLIC_API.md in the repo root.
 *
 * Only published past meetings appear here. The endpoint is open / read-only;
 * we cache for 5 minutes (matching the cadence used by lib/mesh-stats.ts) so
 * the page stays snappy without hammering the export server.
 */

import "server-only";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { MEETING_TZ } from "./meeting-schedule";

export const MEETING_API_BASE = "https://meeting.gulfcoastmesh.org";
const REVALIDATE_SECONDS = 300;

export type PublicMeetingAgenda = {
  originalName: string;
  contentType: string;
  uploadedAt: string;
  size: number;
  /** Relative path returned by the API. Prepend MEETING_API_BASE to fetch. */
  downloadUrl: string;
};

export type PublicMeeting = {
  id: string;
  dateLabel: string;
  startedAt: string;
  endedAt: string;
  youtubeUrl: string;
  publishedAt: string;
  agendas: PublicMeetingAgenda[];
};

type PublicMeetingsResponse = {
  meetings?: PublicMeeting[];
};

/** Detail response — adds transcript + recap to the summary shape. */
export type PublicMeetingDetail = PublicMeeting & {
  transcript: string;
  recap: string;
};

/** Past meeting plus rendered recap HTML, ready for direct injection. */
export type PublicMeetingWithRecap = PublicMeeting & {
  /** Sanitized HTML produced from the recap markdown. Empty when no recap
   *  was returned for the meeting. */
  recapHtml: string;
};

export async function getPublishedMeetings(): Promise<PublicMeeting[]> {
  try {
    const res = await fetch(`${MEETING_API_BASE}/api/public/meetings`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["meetings"] },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as PublicMeetingsResponse;
    if (!Array.isArray(json.meetings)) return [];
    // Defensive: ensure agendas is always an array even if the upstream payload
    // omits it for an older record.
    return json.meetings.map((m) => ({
      ...m,
      agendas: Array.isArray(m.agendas) ? m.agendas : [],
    }));
  } catch {
    return [];
  }
}

export async function getPublishedMeetingDetail(
  id: string,
): Promise<PublicMeetingDetail | null> {
  try {
    const res = await fetch(
      `${MEETING_API_BASE}/api/public/meetings/${encodeURIComponent(id)}`,
      { next: { revalidate: REVALIDATE_SECONDS, tags: ["meetings", `meeting:${id}`] } },
    );
    if (!res.ok) return null;
    const detail = (await res.json()) as PublicMeetingDetail;
    return {
      ...detail,
      agendas: Array.isArray(detail.agendas) ? detail.agendas : [],
      transcript: typeof detail.transcript === "string" ? detail.transcript : "",
      recap: typeof detail.recap === "string" ? detail.recap : "",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the meeting list and then, in parallel, each meeting's recap markdown
 * rendered to sanitized HTML.
 *
 * This is an N+1 request shape, but N is tiny (one row per published meeting,
 * one meeting per week) and every leg is wrapped in Next.js' fetch cache, so
 * in practice this resolves from the data cache on the hot path.
 */
export async function getPublishedMeetingsWithRecap(): Promise<PublicMeetingWithRecap[]> {
  const summaries = await getPublishedMeetings();
  if (summaries.length === 0) return [];
  const enriched = await Promise.all(
    summaries.map(async (m) => {
      const detail = await getPublishedMeetingDetail(m.id);
      const recapHtml = detail?.recap ? await renderRecapMarkdown(detail.recap) : "";
      return { ...m, recapHtml };
    }),
  );
  return enriched;
}

/**
 * Render meeting recap markdown to safe HTML.
 *
 * Strict by design: no raw HTML pass-through (we don't `rehypeRaw`), no
 * autolink-headings or slug plugins (these are card-sized excerpts, not
 * standalone docs pages), and rehype-sanitize is locked to the default safe
 * allowlist. The output is styled by `.prose-mesh` in app/globals.css.
 */
export async function renderRecapMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, defaultSchema)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

/** Turn the API's relative `downloadUrl` into an absolute URL. */
export function absoluteAgendaUrl(downloadUrl: string): string {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  const path = downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`;
  return `${MEETING_API_BASE}${path}`;
}

/**
 * Format an ISO timestamp into a YYYY-MM-DD key in America/Chicago.
 *
 * The meetings nominally run 6:30 - 9:00 PM CST on a Monday. Bucketing by
 * the CST calendar day keeps everything aligned with the Monday cell in the
 * calendar regardless of the visitor's timezone.
 */
export function meetingDateKeyCst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA gives ISO-shaped YYYY-MM-DD output via Intl.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MEETING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Format an ISO timestamp as a short time string in CST (e.g. "6:31 PM"). */
export function formatTimeCst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MEETING_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
