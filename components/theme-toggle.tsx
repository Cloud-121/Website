"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      aria-pressed={theme === "dark"}
      className={
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white/70 text-ink-800 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ink-50 dark:hover:bg-white/10 " +
        className
      }
      style={{ borderColor: "rgb(var(--line) / 0.7)" }}
    >
      {/* Both icons render identically on server + client; CSS toggles them
          based on the `.dark` class already set pre-paint by the theme script.
          This avoids any state-driven hydration mismatch. */}
      <Sun className="hidden h-[18px] w-[18px] dark:block" aria-hidden />
      <Moon className="block h-[18px] w-[18px] dark:hidden" aria-hidden />
    </button>
  );
}
