"use client";

/**
 * ThemeToggle — Sun/moon button for dark mode switching.
 * Stores preference in localStorage, defaults to system preference.
 */

import { useCallback } from "react";

export default function ThemeToggle() {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
  }, []);

  return (
    <button
      onClick={toggle}
      className="rounded-full p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" className="hidden h-5 w-5 dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5M6 12H4.5m15.364 6.364l-1.06-1.06M6.343 6.343L5.282 5.282m13.435 0l-1.061 1.06M6.343 17.657l-1.061 1.061M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      </svg>
    </button>
  );
}
