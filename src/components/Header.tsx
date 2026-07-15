/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Moon, 
  Sun, 
  Star, 
  History, 
  Command, 
  X, 
  Palette,
  Monitor,
  Check,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  COLOR_THEMES,
  THEME_MODES,
  type ColorTheme,
  type ThemeMode,
} from '../theme';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

function getDropdownPosition(trigger: HTMLElement, menuWidth: number, menuHeight: number) {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
  const viewportOffsetLeft = window.visualViewport?.offsetLeft ?? 0;

  const spaceAbove = rect.top - viewportOffsetTop - margin;
  const spaceBelow = viewportHeight - (rect.bottom - viewportOffsetTop) - margin;
  const openAbove = spaceAbove >= menuHeight || spaceAbove > spaceBelow;

  let top = openAbove
    ? rect.top - menuHeight - margin
    : rect.bottom + margin;
  top = Math.max(viewportOffsetTop + margin, Math.min(top, viewportOffsetTop + viewportHeight - menuHeight - margin));

  let left = rect.right - menuWidth;
  left = Math.max(viewportOffsetLeft + margin, Math.min(left, viewportOffsetLeft + viewportWidth - menuWidth - margin));

  return { top, left };
}

function useDropdownPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  menuWidth = 256,
  menuHeight = 320,
) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPosition(getDropdownPosition(trigger, menuWidth, menuHeight));
  }, [triggerRef, menuWidth, menuHeight]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updatePosition);
    visualViewport?.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      visualViewport?.removeEventListener('resize', updatePosition);
      visualViewport?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return position;
}

function useClickOutside(
  open: boolean,
  onClose: () => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!open || !enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, triggerRef, menuRef, enabled]);
}

interface HeaderProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  activeTab: 'dashboard' | 'compare' | 'rankings';
  setActiveTab: (tab: 'dashboard' | 'compare' | 'rankings') => void;
  favorites: string[];
  recentViewed: string[];
  alertsEnabled: boolean;
  onToggleAlerts: (enabled: boolean) => void;
  onSelectPackage: (name: string) => void;
  onRemoveFavorite: (name: string) => void;
}

export default function Header({
  themeMode,
  setThemeMode,
  colorTheme,
  setColorTheme,
  activeTab,
  setActiveTab,
  favorites,
  recentViewed,
  alertsEnabled,
  onToggleAlerts,
  onSelectPackage,
  onRemoveFavorite,
}: HeaderProps) {
  const [showFavs, setShowFavs] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const isMobile = useIsMobile();

  const favsButtonRef = useRef<HTMLButtonElement>(null);
  const favsMenuRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const favsPosition = useDropdownPosition(showFavs && !isMobile, favsButtonRef, 288, 280);
  const themePosition = useDropdownPosition(showThemeMenu && !isMobile, themeButtonRef, 256, 340);

  useClickOutside(showFavs, () => setShowFavs(false), favsButtonRef, favsMenuRef, !isMobile);
  useClickOutside(showThemeMenu, () => setShowThemeMenu(false), themeButtonRef, themeMenuRef, !isMobile);

  useEffect(() => {
    const mobileSheetOpen = isMobile && (showThemeMenu || showFavs);
    if (!mobileSheetOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, showThemeMenu, showFavs]);

  const themeMenuContent = (
    <>
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-indigo-500" /> Themes
        </span>
        <button
          onClick={() => setShowThemeMenu(false)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
            Appearance
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {THEME_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setThemeMode(mode.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  themeMode === mode.id
                    ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {mode.id === 'light' && <Sun className="h-4 w-4" />}
                {mode.id === 'dark' && <Moon className="h-4 w-4" />}
                {mode.id === 'system' && <Monitor className="h-4 w-4" />}
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
            Accent Color
          </p>
          <div className="space-y-1">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all ${
                  colorTheme === theme.id
                    ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                    style={{ backgroundColor: theme.color }}
                  />
                  {theme.label}
                </span>
                {colorTheme === theme.id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const favsMenuContent = (
    <>
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Bookmarked Packages ({favorites.length})
        </span>
        <button onClick={() => setShowFavs(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto p-2 space-y-1">
        {favorites.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No bookmarks saved yet. Click the star icon on any package to save!
          </div>
        ) : (
          favorites.map((fav) => (
            <div
              key={fav}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group transition-all"
            >
              <button
                onClick={() => {
                  onSelectPackage(fav);
                  setShowFavs(false);
                }}
                className="text-sm font-mono text-left font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate flex-1 mr-2"
              >
                {fav}
              </button>
              <button
                onClick={() => onRemoveFavorite(fav)}
                className="text-zinc-400 hover:text-rose-500 p-1 rounded transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}

        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => onToggleAlerts(!alertsEnabled)}
            className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg text-xs font-semibold transition-all ${
              alertsEnabled
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
                : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {alertsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              Watchlist alerts
            </span>
            <span className="text-[10px] uppercase">{alertsEnabled ? 'On' : 'Off'}</span>
          </button>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1 leading-relaxed">
            Browser notifications when bookmarked packages are deprecated, get CVEs, or go stale.
          </p>
        </div>

        {recentViewed.length > 0 && (
          <>
            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 mt-2 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3 w-3" /> Recent History
            </div>
            {recentViewed.slice(0, 5).map((rec) => (
              <button
                key={rec}
                onClick={() => {
                  onSelectPackage(rec);
                  setShowFavs(false);
                }}
                className="w-full text-left p-1.5 rounded text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white truncate block"
              >
                {rec}
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard' },
    { id: 'compare' as const, label: 'Compare' },
    { id: 'rankings' as const, label: 'Rankings' },
  ];

  const brand = (
    <div
      className="flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer"
      onClick={() => setActiveTab('dashboard')}
    >
      <img src="/icon.svg" alt="" className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
      <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
        NPM <span className="hidden min-[400px]:inline text-zinc-500 dark:text-zinc-400 font-normal">Analytics</span>
      </h1>
    </div>
  );

  const toolbar = (
    <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div>
            <button
              ref={favsButtonRef}
              onClick={() => {
                setShowFavs(!showFavs);
                setShowShortcuts(false);
                setShowThemeMenu(false);
              }}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all relative"
              title="Bookmarks & Favorites"
            >
              <Star className={`h-5 w-5 ${favorites.length > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
              {favorites.length > 0 && (
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>

            {showFavs && !isMobile && favsPosition && createPortal(
              <div
                ref={favsMenuRef}
                className="fixed w-72 rounded-xl shadow-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[200]"
                style={{ top: favsPosition.top, left: favsPosition.left }}
              >
                {favsMenuContent}
              </div>,
              document.body,
            )}

            {showFavs && isMobile && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[199] bg-black/50"
                  onClick={() => setShowFavs(false)}
                  aria-hidden="true"
                />
                <div
                  ref={favsMenuRef}
                  className="fixed inset-x-0 bottom-0 z-[200] max-h-[min(24rem,85dvh)] overflow-y-auto rounded-t-2xl bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                >
                  {favsMenuContent}
                </div>
              </>,
              document.body,
            )}
          </div>

          {/* Keyboard Shortcuts Dialog Trigger */}
          <button
            onClick={() => {
              setShowShortcuts(!showShortcuts);
              setShowFavs(false);
              setShowThemeMenu(false);
            }}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all hidden md:block"
            title="Keyboard Shortcuts"
          >
            <Command className="h-5 w-5" />
          </button>

          {/* Theme Selector */}
          <div>
            <button
              ref={themeButtonRef}
              onClick={() => {
                setShowThemeMenu(!showThemeMenu);
                setShowFavs(false);
                setShowShortcuts(false);
              }}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              title="Theme settings"
            >
              <Palette className="h-5 w-5 text-indigo-500" />
            </button>

            {showThemeMenu && !isMobile && themePosition && createPortal(
              <div
                ref={themeMenuRef}
                className="fixed w-64 max-h-[min(24rem,calc(100vh-1rem))] overflow-y-auto rounded-xl shadow-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 z-[200]"
                style={{ top: themePosition.top, left: themePosition.left }}
              >
                {themeMenuContent}
              </div>,
              document.body,
            )}

            {showThemeMenu && isMobile && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[199] bg-black/50"
                  onClick={() => setShowThemeMenu(false)}
                  aria-hidden="true"
                />
                <div
                  ref={themeMenuRef}
                  className="fixed inset-x-0 bottom-0 z-[200] max-h-[min(28rem,85dvh)] overflow-y-auto rounded-t-2xl bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                >
                  {themeMenuContent}
                </div>
              </>,
              document.body,
            )}
          </div>

    </div>
  );

  const tabNav = (mobile: boolean) => (
    <nav className={mobile ? 'flex w-full gap-1' : 'flex gap-2'}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`${mobile ? 'flex-1 min-w-0' : ''} px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Mobile: title + actions on row 1, tabs on row 2 */}
        <div className="md:hidden py-3 space-y-3">
          <div className="flex items-center justify-between gap-3 min-w-0">
            {brand}
            {toolbar}
          </div>
          {tabNav(true)}
        </div>

        {/* Desktop: single row */}
        <div className="hidden md:flex h-16 items-center justify-between gap-6">
          {brand}
          {tabNav(false)}
          {toolbar}
        </div>

      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowShortcuts(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
              <Command className="h-5 w-5 text-indigo-500" /> Keyboard Shortcuts
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Focus Search Bar</span>
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs rounded shadow-sm font-mono text-zinc-800 dark:text-zinc-200">
                  /
                </kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Cycle Theme Mode</span>
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs rounded shadow-sm font-mono text-zinc-800 dark:text-zinc-200">
                  Ctrl + M
                </kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Switch to Dashboard Tab</span>
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs rounded shadow-sm font-mono text-zinc-800 dark:text-zinc-200">
                  Ctrl + D
                </kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Switch to Compare Tab</span>
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs rounded shadow-sm font-mono text-zinc-800 dark:text-zinc-200">
                  Ctrl + C
                </kbd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Switch to Rankings Tab</span>
                <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs rounded shadow-sm font-mono text-zinc-800 dark:text-zinc-200">
                  Ctrl + R
                </kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-md transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
