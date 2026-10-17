import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';

const ThemeContext = createContext({
  theme: 'dark',
  isDark: true,
  isLight: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'luxe_theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {}
    return 'dark';
  });

  const applyTheme = (currentTheme) => {
    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
      body.classList.add('dark-theme');
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {}
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  const value = {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Universal Luxury Theme Toggle Component
 * Can be placed in Header, Navbar, Sidebar, or as a Floating Pill
 */
export function ThemeToggle({ variant = 'button', showLabel = true, className = '' }) {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'floating') {
    return (
      <button
        onClick={toggleTheme}
        className={`floating-theme-toggle ${className}`}
        title={`Switch to ${isDark ? 'Luxury Ivory Light' : 'Noir Obsidian Dark'} Mode`}
        aria-label="Toggle Luxury Theme"
      >
        {isDark ? (
          <Sun size={18} className="theme-toggle-icon sun-icon" />
        ) : (
          <Moon size={18} className="theme-toggle-icon moon-icon" />
        )}
        <span className="floating-theme-label">
          {isDark ? 'Light' : 'Dark'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`luxury-theme-toggle-btn ${className}`}
      title={`Switch to ${isDark ? 'Luxury Ivory Light' : 'Noir Obsidian Dark'} Mode`}
      aria-label="Toggle Luxury Theme"
    >
      <div className="toggle-icon-wrap">
        {isDark ? (
          <Sun size={15} className="sun-icon text-amber-400" />
        ) : (
          <Moon size={15} className="moon-icon text-indigo-400" />
        )}
      </div>
      {showLabel && (
        <span className="toggle-label-text">
          {isDark ? 'Ivory Mode' : 'Noir Mode'}
        </span>
      )}
    </button>
  );
}
