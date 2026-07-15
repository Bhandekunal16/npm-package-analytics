/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import CompareView from './components/CompareView';
import RankingsView from './components/RankingsView';
import {
  applyTheme,
  readStoredColorTheme,
  readStoredThemeMode,
  THEME_MODES,
  type ColorTheme,
  type ThemeMode,
} from './theme';

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredThemeMode);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(readStoredColorTheme);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'compare' | 'rankings'>('dashboard');
  const [activePackage, setActivePackage] = useState<string>('express');

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentViewed, setRecentViewed] = useState<string[]>([]);

  // 1. Initial configuration, parsing URL query parameters, and restoring localStorage
  useEffect(() => {
    // Restore bookmarks & history
    const storedFavs = localStorage.getItem('npm_analytics_favs');
    if (storedFavs) {
      try { setFavorites(JSON.parse(storedFavs)); } catch (e) { console.error(e); }
    }

    const storedRecents = localStorage.getItem('npm_analytics_recents');
    if (storedRecents) {
      try { setRecentViewed(JSON.parse(storedRecents)); } catch (e) { console.error(e); }
    }

    // Parse URL query parameter: ?package=xyz
    const params = new URLSearchParams(window.location.search);
    const urlPkg = params.get('package');
    if (urlPkg) {
      setActivePackage(urlPkg.trim());
    }
  }, []);

  useEffect(() => {
    applyTheme(themeMode, colorTheme);
    localStorage.setItem('npm_analytics_theme_mode', themeMode);
    localStorage.setItem('npm_analytics_color_theme', colorTheme);
  }, [themeMode, colorTheme]);

  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system', colorTheme);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, colorTheme]);

  // 2. Track recently viewed additions
  const handleSelectPackage = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setActivePackage(cleanName);
    setActiveTab('dashboard');

    setRecentViewed((prev) => {
      const filtered = prev.filter((p) => p.toLowerCase() !== cleanName.toLowerCase());
      const updated = [cleanName, ...filtered].slice(0, 10);
      localStorage.setItem('npm_analytics_recents', JSON.stringify(updated));
      return updated;
    });

    // Update URL query state gracefully without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set('package', cleanName);
    window.history.pushState({}, '', url.toString());
  };

  // 3. Toggle Bookmark Favorite status
  const handleToggleFavorite = (name: string) => {
    setFavorites((prev) => {
      let updated;
      if (prev.includes(name)) {
        updated = prev.filter((p) => p !== name);
      } else {
        updated = [...prev, name];
      }
      localStorage.setItem('npm_analytics_favs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveFavorite = (name: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((p) => p !== name);
      localStorage.setItem('npm_analytics_favs', JSON.stringify(updated));
      return updated;
    });
  };

  // 4. Global Keyboard tab toggles (Ctrl+M, Ctrl+D, Ctrl+C, Ctrl+R)
  useEffect(() => {
    function handleGlobalKeys(e: KeyboardEvent) {
      if (e.ctrlKey) {
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setThemeMode((prev) => {
            const currentIndex = THEME_MODES.findIndex((mode) => mode.id === prev);
            const nextIndex = (currentIndex + 1) % THEME_MODES.length;
            return THEME_MODES[nextIndex].id;
          });
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setActiveTab('dashboard');
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          setActiveTab('compare');
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          setActiveTab('rankings');
        }
      }
    }
    document.addEventListener('keydown', handleGlobalKeys);
    return () => document.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  return (
    <div className="min-h-screen transition-colors duration-200 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
        
        {/* Navigation Navbar */}
        <Header
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          colorTheme={colorTheme}
          setColorTheme={setColorTheme}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          favorites={favorites}
          recentViewed={recentViewed}
          onSelectPackage={handleSelectPackage}
          onRemoveFavorite={handleRemoveFavorite}
        />

        {/* Core Workspace Frame */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {activeTab === 'dashboard' && (
            <DashboardOverview
              packageName={activePackage}
              onSelectPackage={handleSelectPackage}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeTab === 'compare' && (
            <CompareView
              onSelectPackage={handleSelectPackage}
              favorites={favorites}
            />
          )}

          {activeTab === 'rankings' && (
            <RankingsView
              onSelectPackage={handleSelectPackage}
            />
          )}

        </main>

        {/* Global layout subtle backdrop footer credits */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 py-5 text-center text-[11px] text-zinc-500 dark:text-zinc-500 font-mono mt-16 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-4 items-center">
              <span>Status: <span className="text-emerald-500 font-semibold">● Operational</span></span>
              <span className="text-zinc-400 dark:text-zinc-600">|</span>
              <span>API Latency: 42ms</span>
            </div>
            <div>
              <span>© {new Date().getFullYear()} PackageLens • NPM Package Analytics</span>
            </div>
          </div>
        </footer>

    </div>
  );
}
