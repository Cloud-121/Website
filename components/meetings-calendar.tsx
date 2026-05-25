"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Youtube } from "lucide-react";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * Month-grid calendar for /meetings.
 *
 * The grid is rendered in ET because the underlying schedule is ET-anchored
 * (every Monday 7:30 - 10:00 PM ET). That keeps "which Monday is which"
 * unambiguous regardless of where the visitor sits. Past Mondays for which
 * the public API returned a published recap get a YouTube link inline.
 *
 * SSR-safe: the outer wrapper renders a stable skeleton while hydrating. Only
 * after mount does the inner component subscribe to the visitor's clock, so
 * the server and the first client render emit identical markup.
 */

type CalendarMeeting = {
  id: string;
  youtubeUrl: string;
  dateLabel: string;
};

type Props = {
  publishedByDateKey: Record<string, CalendarMeeting>;
};

const MEETING_TZ = "America/New_York";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function nowInEt(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function keyOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

type Cell = {
  key: string;
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

function buildMonthCells(year: number, month: number): Cell[] {
  // Anchor on UTC midnight so `getUTCDay()` is consistent regardless of where
  // this code runs. This is purely a calendar-math helper; we treat the
  // (year, month, day) tuple as the ET wall date with no timezone ambiguity.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay();
  const startDay = 1 - firstWeekday;
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month - 1, startDay + i));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    cells.push({
      key: keyOf(y, m, day),
      year: y,
      month: m,
      day,
      inMonth: m === month,
      weekday: d.getUTCDay(),
    });
  }
  return cells;
}

export function MeetingsCalendar({ publishedByDateKey }: Props) {
  const mounted = useHasMounted();
  if (!mounted) {
    return (
      <section
        className="surface mt-10 p-6 sm:p-8"
        aria-label="Meetings calendar (loading)"
      >
        <div className="h-[420px] animate-pulse rounded-2xl bg-ink-100/40 dark:bg-white/5" />
      </section>
    );
  }
  return <MountedCalendar publishedByDateKey={publishedByDateKey} />;
}

function MountedCalendar({ publishedByDateKey }: Props) {
  // Initial view is the current ET month, captured once on mount. This
  // initializer only runs after hydration (because the parent gates rendering
  // on `useHasMounted`), so reading the visitor's clock is safe here.
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const et = nowInEt(new Date());
    return { year: et.year, month: et.month };
  });
  const todayKey = useMemo(() => {
    const et = nowInEt(new Date());
    return keyOf(et.year, et.month, et.day);
  }, []);

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view]);

  const goPrev = () =>
    setView((v) => {
      const m = v.month - 1;
      if (m < 1) return { year: v.year - 1, month: 12 };
      return { year: v.year, month: m };
    });
  const goNext = () =>
    setView((v) => {
      const m = v.month + 1;
      if (m > 12) return { year: v.year + 1, month: 1 };
      return { year: v.year, month: m };
    });
  const goToday = () => {
    const et = nowInEt(new Date());
    setView({ year: et.year, month: et.month });
  };

  return (
    <section className="surface relative mt-10 overflow-hidden p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 px-1 pb-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gulf-700 dark:text-gulf-300">
            Schedule (ET)
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
            {MONTH_NAMES[view.month - 1]} {view.year}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white/70 text-ink-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ink-100 dark:hover:bg-white/10"
            style={{ borderColor: "rgb(var(--line) / 0.7)" }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-9 items-center rounded-xl border bg-white/70 px-3 text-xs font-semibold text-ink-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ink-100 dark:hover:bg-white/10"
            style={{ borderColor: "rgb(var(--line) / 0.7)" }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white/70 text-ink-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ink-100 dark:hover:bg-white/10"
            style={{ borderColor: "rgb(var(--line) / 0.7)" }}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 px-1 pb-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-ink-400">
        {DOW_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-1">
        {cells.map((cell) => (
          <CalendarCell
            key={cell.key}
            cell={cell}
            todayKey={todayKey}
            published={publishedByDateKey[cell.key]}
          />
        ))}
      </div>

      <p className="mt-4 px-1 text-xs text-ink-500 dark:text-ink-400">
        Mondays are meeting nights — 7:30 - 10:00 PM ET. Past Mondays link to the YouTube recap when published.
      </p>
    </section>
  );
}

function CalendarCell({
  cell,
  todayKey,
  published,
}: {
  cell: Cell;
  todayKey: string;
  published?: CalendarMeeting;
}) {
  const isMonday = cell.weekday === 1;
  const isToday = todayKey === cell.key;
  const isPast = cell.key < todayKey;

  const baseClass =
    "relative flex aspect-square min-h-[58px] flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[72px] sm:p-2";
  const mutedText = cell.inMonth ? "" : "opacity-40";
  const todayRing = isToday ? "ring-2 ring-gulf-400/60 ring-offset-1 ring-offset-transparent" : "";
  const mondayAccent = isMonday
    ? "border-gulf-400/40 bg-gulf-500/5 dark:border-gulf-400/30 dark:bg-gulf-500/10"
    : "";
  const inactiveBorder = !isMonday
    ? "border-ink-200/60 bg-white/40 dark:border-white/10 dark:bg-white/[0.02]"
    : "";

  const inner = (
    <>
      <span
        className={
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
          (isMonday
            ? "bg-gulf-500/20 text-gulf-700 dark:text-gulf-200"
            : "text-ink-700 dark:text-ink-200")
        }
      >
        {cell.day}
      </span>
      {isMonday ? (
        <div className="mt-auto flex flex-col gap-0.5">
          <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-gulf-700 sm:inline dark:text-gulf-300">
            7:30 PM ET
          </span>
          {published ? (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-sand-400/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-sand-700 dark:text-sand-300">
              <Youtube className="h-2.5 w-2.5" aria-hidden />
              Recap
            </span>
          ) : isPast ? null : (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-gulf-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-gulf-700 dark:text-gulf-200">
              <span className="h-1 w-1 rounded-full bg-gulf-500" />
              Meeting
            </span>
          )}
        </div>
      ) : null}
    </>
  );

  if (isMonday && published) {
    return (
      <a
        href={published.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Recap — ${published.dateLabel}`}
        className={`${baseClass} ${mondayAccent} ${todayRing} ${mutedText} group cursor-pointer hover:-translate-y-0.5 hover:border-gulf-400/70 hover:bg-gulf-500/10`}
      >
        {inner}
        <ArrowUpRight
          className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-gulf-700 opacity-0 transition group-hover:opacity-100 dark:text-gulf-300"
          aria-hidden
        />
      </a>
    );
  }

  return (
    <div className={`${baseClass} ${isMonday ? mondayAccent : inactiveBorder} ${todayRing} ${mutedText}`}>
      {inner}
    </div>
  );
}
