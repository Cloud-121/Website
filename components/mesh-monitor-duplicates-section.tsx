import { fmtCount, formatSeenAt, type DuplicatesResponse } from "@/lib/mesh-monitor";

type Props = {
  ok: boolean;
  data: DuplicatesResponse;
};

export function MeshMonitorDuplicatesSection({ ok, data }: Props) {
  const generatedAt =
    data.timestamp &&
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(data.timestamp));

  return (
    <div>
      <p className="max-w-2xl text-sm text-ink-600 dark:text-ink-300">
        When two or more repeaters advertise the same hex prefix under different names, routing and
        map deduplication can break down. Operators should coordinate to resolve conflicts.
      </p>

      {!ok ? (
        <p className="mt-4 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-900 dark:text-coral-100">
          Could not load duplicate prefix data. Try refreshing the page.
        </p>
      ) : null}

      <div className="mt-8">
        {data.count === 0 ? (
          <div className="surface p-10 text-center">
            <p className="font-display text-xl font-semibold text-ink-900 dark:text-white">
              No duplicate prefixes detected
            </p>
            <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
              Every active repeater prefix maps to a single name in the current window.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-ink-400">
              {fmtCount(data.count)} conflict{data.count === 1 ? "" : "s"} found
            </p>
            <ul className="grid gap-5">
              {data.duplicates.map((group) => (
                <li key={group.prefix} className="surface p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-ink-900 dark:text-white">
                      Prefix{" "}
                      <code className="rounded-md bg-gulf-500/10 px-2 py-0.5 font-mono text-lg text-gulf-800 dark:text-gulf-200">
                        {group.prefix}
                      </code>
                    </h3>
                    <span className="rounded-full bg-coral-500/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-coral-800 dark:text-coral-200">
                      {group.count} nodes
                    </span>
                  </div>
                  <ul className="mt-5 divide-y divide-ink-200/50 dark:divide-white/10">
                    {group.nodes.map((node) => (
                      <li
                        key={node.public_key}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="font-medium text-ink-900 dark:text-white">{node.name}</span>
                        <span className="font-mono text-xs text-ink-500 dark:text-ink-400">
                          Last seen {formatSeenAt(node.last_seen)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {generatedAt ? (
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          Checked {generatedAt}
        </p>
      ) : null}
    </div>
  );
}
