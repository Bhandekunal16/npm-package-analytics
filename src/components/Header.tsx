/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Compass, 
  Layers, 
  Moon, 
  Sun, 
  Star, 
  History, 
  Command, 
  X, 
  ShieldAlert, 
  Award,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  activeTab: 'dashboard' | 'compare' | 'rankings';
  setActiveTab: (tab: 'dashboard' | 'compare' | 'rankings') => void;
  favorites: string[];
  recentViewed: string[];
  onSelectPackage: (name: string) => void;
  onRemoveFavorite: (name: string) => void;
}

export default function Header({
  darkMode,
  setDarkMode,
  activeTab,
  setActiveTab,
  favorites,
  recentViewed,
  onSelectPackage,
  onRemoveFavorite,
}: HeaderProps) {
  const [showFavs, setShowFavs] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold italic text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]">
            N
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              NPM <span className="text-zinc-500 dark:text-zinc-400 font-normal">Analytics</span>
            </h1>
          </div>
        </div>

        {/* Primary Tabs */}
        <nav className="flex space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
              activeTab === 'compare'
                ? 'bg-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Compare
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all ${
              activeTab === 'rankings'
                ? 'bg-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Rankings
          </button>
        </nav>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-3">
          
          {/* Favorites Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFavs(!showFavs);
                setShowShortcuts(false);
              }}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all relative"
              title="Bookmarks & Favorites"
            >
              <Star className={`h-5 w-5 ${favorites.length > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
              {favorites.length > 0 && (
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>

            {/* Favorites Dropdown Card */}
            {showFavs && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl shadow-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Bookmarked Packages ({favorites.length})
                  </span>
                  <button onClick={() => setShowFavs(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
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
                          className="text-zinc-400 hover:text-rose-500 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}

                  {/* Recently Viewed Sub-Section */}
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
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Dialog Trigger */}
          <button
            onClick={() => {
              setShowShortcuts(!showShortcuts);
              setShowFavs(false);
            }}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all hidden md:block"
            title="Keyboard Shortcuts"
          >
            <Command className="h-5 w-5" />
          </button>

          {/* Theme Selector */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-600" />}
          </button>

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
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Toggle Dark / Light Mode</span>
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
