"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * "Next meeting" hero card for /meetings.
 *
 * Source of truth: the community meeting runs every Monday from 7:30 PM to
 * 10:00 PM America/New_York (Eastern). This card translates the next
 * occurrence into the visitor's local clock so a member on the Gulf Coast
 * sees their own time, not someone else's.
 *
 * SSR-safe: while hydrating, the wrapper renders a static placeholder. Only
 * after mount does it swap to the localized "in X hours" string, which keeps
 * the server-rendered HTML stable across timezones.
 */

const MEETING_TZ = "America/New_York";
const MEETING_HOUR = 19;
const MEETING_MINUTE = 30;
const MEETING_END_HOUR = 22;
const MEETING_END_MINUTE = 0;

function tzWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Convert a (year, month, day, hour, minute) tuple interpreted in `timeZone`
  // into the corresponding UTC instant. Works around the lack of a native
  // `Date.fromZoned` by using the "guess and correct" trick:
  //   1. Treat the wall-time as if it were UTC ("guess").
  //   2. Ask Intl what that guessed instant *displays as* in the target zone.
  //   3. The delta between the wall-time and what the zone displays is the
  //      offset we need to subtract to get the true UTC instant.
  const guessMs = Date.UTC(year, month - 1, day, hour, minute);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guessMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const zonedMs = Date.UTC(
    parseInt(get("year"), 10),
    parseInt(get("month"), 10) - 1,
    parseInt(get("day"), 10),
    parseInt(get("hour"), 10) % 24,
    parseInt(get("minute"), 10),
  );
  return new Date(guessMs + (guessMs - zonedMs));
}

type EtCalendar = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function nowInEt(now: Date): EtCalendar {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

type NextMeeting = {
  start: Date;
  end: Date;
  inProgress: boolean;
};

function computeNextMeeting(now: Date): NextMeeting {
  const et = nowInEt(now);
  let daysToAdd = (1 - et.weekday + 7) % 7;
  if (daysToAdd === 0) {
    const minutesNow = et.hour * 60 + et.minute;
    const endMinutes = MEETING_END_HOUR * 60 + MEETING_END_MINUTE;
    if (minutesNow >= endMinutes) {
      // It's Monday in ET but the meeting has already ended. Skip ahead a week.
      daysToAdd = 7;
    }
  }
  // Adding to `day` lets the Date constructor normalize end-of-month rollovers
  // for us, so we don't have to special-case Jan 31 + 1 = Feb 1, etc.
  const targetUtc = new Date(Date.UTC(et.year, et.month - 1, et.day + daysToAdd));
  const ty = targetUtc.getUTCFullYear();
  const tm = targetUtc.getUTCMonth() + 1;
  const td = targetUtc.getUTCDate();

  const start = tzWallToUtc(ty, tm, td, MEETING_HOUR, MEETING_MINUTE, MEETING_TZ);
  const end = tzWallToUtc(ty, tm, td, MEETING_END_HOUR, MEETING_END_MINUTE, MEETING_TZ);
  return {
    start,
    end,
    inProgress: now >= start && now <= end,
  };
}

function formatLocal(start: Date): string {
  return start.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatCountdown(start: Date, now: Date): string {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return "Happening now";
  const minutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  if (mins > 0) return `in ${mins} min`;
  return "starting now";
}

function Shell({
  eyebrow,
  localized,
  countdown,
}: {
  eyebrow: string;
  localized: string;
  countdown: string;
}) {
  return (
    <section className="surface relative mt-12 overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gulf-400/15 via-transparent to-sand-400/10" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gulf-500/15 text-gulf-700 dark:text-gulf-300">
            <CalendarClock className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gulf-700 dark:text-gulf-300">
              {eyebrow}
            </p>
            <p
              className="mt-1 font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl dark:text-white"
              suppressHydrationWarning
            >
              {localized}
            </p>
            <p
              className="mt-1 text-sm text-ink-600 dark:text-ink-300"
              suppressHydrationWarning
            >
              <span className="font-medium">{countdown}</span>
              <span className="mx-1.5 text-ink-400">·</span>
              7:30 - 10:00 PM ET every Monday
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href="https://discord.gulfcoastmesh.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Join on Discord
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

function MountedNextMeetingCard() {
  // Re-render every 60s so the "in X hours" countdown stays current. Setting
  // state inside the interval callback is allowed by React 19's
  // set-state-in-effect lint (it's a subscription, not an effect-body call).
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const next = computeNextMeeting(now);
  return (
    <Shell
      eyebrow={next.inProgress ? "Meeting in progress" : "Next meeting"}
      localized={formatLocal(next.start)}
      countdown={formatCountdown(next.start, now)}
    />
  );
}

export function NextMeetingCard() {
  const mounted = useHasMounted();
  if (!mounted) {
    return (
      <Shell
        eyebrow="Next meeting"
        localized="Monday · 7:30 PM ET"
        countdown="every week"
      />
    );
  }
  return <MountedNextMeetingCard />;
}
