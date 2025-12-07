"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const THEME_KEY = "km_theme"; // 'dark' | 'light'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
      let initial: 'dark' | 'light' = 'dark';
      if (saved === 'dark' || saved === 'light') {
        initial = saved;
      } else if (typeof window !== 'undefined' && window.matchMedia) {
        initial = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    } catch {}
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    try { document.documentElement.setAttribute('data-theme', next); } catch {}
  };

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-90"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}