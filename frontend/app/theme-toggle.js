'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'casualfunnel_theme';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme = stored === 'light' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      applyTheme(nextTheme);
      return nextTheme;
    });
  }

  const isLight = theme === 'light';

  return (
    <button
      className="themeToggle"
      type="button"
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={toggleTheme}
    >
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
