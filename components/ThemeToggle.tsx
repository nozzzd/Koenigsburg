"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

/** Must match the key read by the anti-flash script in app/layout.tsx. */
const STORAGE_KEY = "kbg-theme";

/**
 * Dark is the default and needs no attribute; light sets data-theme="light",
 * which swaps the palette variables in globals.css.
 */
function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage blocked — the choice just won't persist.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Read what the head script already applied, so the UI matches on mount.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  const options: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
  ];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-800 text-gold-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
