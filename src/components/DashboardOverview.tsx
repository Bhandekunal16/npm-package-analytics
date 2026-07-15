/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Star, 
  ExternalLink, 
  Download, 
  Calendar, 
  Award, 
  AlertTriangle, 
  Info,
  CheckCircle,
  Clock,
  User,
  ShieldAlert,
  GitCommit,
  GitFork,
  ArrowRight,
  TrendingUp,
  FileDown,
  Command,
  HelpCircle,
  Terminal,
  Activity,
  Layers,
  AlertOctagon,
  BadgeCheck,
  Building2,
  BarChart3,
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { NPMFullPackageData, RepositoryRiskLevel, SearchResult } from '../types';
import { resolvePublisherInfo, resolveRepositoryRisk, resolveDependencyAudit, resolveAlternatives, resolveSecurity } from '../packageDefaults';
import { updateWatchSnapshot } from '../watchlistAlerts';
import DependencyTree from './DependencyTree';
import PackageInsightsPanel from './PackageInsightsPanel';
import SecurityDeepDive from './SecurityDeepDive';
import TransitiveDependencyTree from './TransitiveDependencyTree';
import AlternativesPanel from './AlternativesPanel';

interface KpiStatCardProps {
  label: string;
  value: React.ReactNode;
  fullValue?: React.ReactNode;
  title?: string;
  accent?: boolean;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}

function KpiStatCard({
  label,
  value,
  fullValue,
  title,
  accent,
  expanded,
  onExpand,
  onClose,
}: KpiStatCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const detailValue = fullValue ?? value;
  const valueColor = accent
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-zinc-900 dark:text-white';

  const updatePopupPosition = useCallback(() => {
    const card = cardRef.current;
    const popup = popupRef.current;
    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    const popupWidth = popup?.offsetWidth ?? 200;
    const margin = 8;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportOffsetLeft = window.visualViewport?.offsetLeft ?? 0;

    let left = cardRect.left + cardRect.width / 2 - popupWidth / 2;
    left = Math.max(
      viewportOffsetLeft + margin,
      Math.min(left, viewportOffsetLeft + viewportWidth - popupWidth - margin),
    );

    setPopupPosition({
      top: cardRect.bottom + 6,
      left,
    });
  }, []);

  useEffect(() => {
    if (!expanded) {
      setPopupPosition(null);
      return;
    }

    updatePopupPosition();
    const frameId = window.requestAnimationFrame(updatePopupPosition);

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updatePopupPosition);
    visualViewport?.addEventListener('scroll', updatePopupPosition);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      visualViewport?.removeEventListener('resize', updatePopupPosition);
      visualViewport?.removeEventListener('scroll', updatePopupPosition);
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [expanded, updatePopupPosition, detailValue]);

  useEffect(() => {
    if (!expanded) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (cardRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener('mousedown', close);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('mousedown', close);
    };
  }, [expanded, onClose]);

  const handleClick = () => {
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    if (expanded) {
      onClose();
    } else {
      onExpand();
    }
  };

  return (
    <div ref={cardRef} className="relative min-w-0 h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
        title={!expanded ? title : undefined}
        className={`h-full min-h-[4.75rem] flex flex-col justify-center min-w-0 p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-sm shadow-sm hover:border-indigo-500/50 transition-colors md:cursor-pointer overflow-hidden ${
          expanded ? 'md:ring-2 md:ring-indigo-500/40' : ''
        }`}
      >
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block leading-tight">
          {label}
        </span>
        <span
          className={`text-sm sm:text-base xl:text-lg font-mono font-bold mt-1 block tabular-nums truncate ${valueColor}`}
        >
          {value}
        </span>
      </div>

      {expanded && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          className="hidden md:block fixed z-[200] w-max max-w-[min(20rem,calc(100vw-2rem))] p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl ring-1 ring-indigo-500/20"
          style={popupPosition ? { top: popupPosition.top, left: popupPosition.left } : { top: -9999, left: -9999 }}
        >
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block leading-tight">
            {label}
          </span>
          <span className={`text-base font-mono font-bold mt-1 block tabular-nums whitespace-nowrap ${valueColor}`}>
            {detailValue}
          </span>
        </div>,
        document.body,
      )}
    </div>
  );
}

function repositoryRiskStyles(level: RepositoryRiskLevel) {
  if (level === 'High') {
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-900/40',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    };
  }
  if (level === 'Medium') {
    return {
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-900/40',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    };
  }
  return {
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900/40',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  };
}

function formatPublishDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return dateStr.split('T')[0];
}

interface DashboardOverviewProps {
  packageName: string;
  onSelectPackage: (name: string) => void;
  favorites: string[];
  onToggleFavorite: (name: string) => void;
}

export default function DashboardOverview({
  packageName,
  onSelectPackage,
  favorites,
  onToggleFavorite,
}: DashboardOverviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pkgData, setPkgData] = useState<NPMFullPackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Download chart ranges: 7, 30, 90, 365, 'custom'
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90' | '365' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [activeTabSection, setActiveTabSection] = useState<'overview' | 'insights' | 'dependencies' | 'versions' | 'security'>('overview');
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch package details
  useEffect(() => {
    async function loadPackage() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/package/${encodeURIComponent(packageName)}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Package "${packageName}" not found on npm.`);
          }
          throw new Error('Ecosystem registry failed to provide details.');
        }
        const data = await res.json();
        setPkgData(data);
        setSearchQuery(data.name);
        updateWatchSnapshot(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPackage();
  }, [packageName]);

  useEffect(() => {
    setExpandedKpi(null);
  }, [packageName]);

  // Autocomplete suggestions search with simple debouncing
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery === pkgData?.name) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (e) {
        console.error('Failed to load autocomplete suggestions:', e);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, pkgData?.name]);

  // Handle click outside suggestions to close them
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="py-8 space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-3/4"></div>
        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded-xl"></div>
          ))}
        </div>
        {/* Main Area Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-zinc-150 dark:bg-zinc-900 rounded-2xl"></div>
          <div className="h-96 bg-zinc-150 dark:bg-zinc-900 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error || !pkgData) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/10 p-8">
        <AlertTriangle className="h-12 w-12 mx-auto text-rose-500" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">Lookup Error</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{error || 'Unable to retrieve package data.'}</p>
        
        {/* Retry search bar */}
        <div className="mt-6 flex gap-2">
          <input
            type="text"
            placeholder="Search another package..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSelectPackage((e.target as HTMLInputElement).value);
              }
            }}
            className="block w-full rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white"
          />
        </div>
      </div>
    );
  }

  const publisherInfo = resolvePublisherInfo(pkgData);
  const repositoryRisk = resolveRepositoryRisk(pkgData);
  const dependencyAudit = resolveDependencyAudit(pkgData);
  const security = resolveSecurity(pkgData);
  const alternatives = resolveAlternatives(pkgData);

  // Filter downloads data based on range
  const getFilteredChartData = () => {
    const history = pkgData.downloads.history || [];
    let rangeDays = 30;
    
    if (timeRange === '7') rangeDays = 7;
    else if (timeRange === '90') rangeDays = 90;
    else if (timeRange === '365') rangeDays = 365;
    else if (timeRange === 'custom' && customStartDate && customEndDate) {
      return history.filter(h => h.day >= customStartDate && h.day <= customEndDate);
    }

    return history.slice(-rangeDays);
  };

  const chartData = getFilteredChartData();

  // Inject 7-day Moving Average (SMA) if toggled
  const getChartDataWithSMA = () => {
    return chartData.map((d, idx) => {
      if (!showMovingAverage) return d;
      
      const windowSize = 7;
      const startIdx = Math.max(0, idx - windowSize + 1);
      const subHistory = chartData.slice(startIdx, idx + 1);
      const average = Math.round(subHistory.reduce((acc, x) => acc + x.downloads, 0) / subHistory.length);
      
      return {
        ...d,
        sma: idx >= windowSize - 1 ? average : null // only render moving average when we have enough days
      };
    });
  };

  const formattedChartData = getChartDataWithSMA();

  // Recalculate metrics on the filtered time window
  const getFilteredMetrics = () => {
    if (chartData.length === 0) return { total: 0, peak: { day: 'N/A', downloads: 0 }, lowest: { day: 'N/A', downloads: 0 }, average: 0 };
    
    let total = 0;
    let peak = { day: '', downloads: 0 };
    let lowest = { day: '', downloads: Infinity };

    chartData.forEach((h) => {
      total += h.downloads;
      if (h.downloads > peak.downloads) {
        peak = { day: h.day, downloads: h.downloads };
      }
      if (h.downloads < lowest.downloads) {
        lowest = { day: h.day, downloads: h.downloads };
      }
    });

    return {
      total,
      peak,
      lowest: lowest.downloads === Infinity ? { day: 'N/A', downloads: 0 } : lowest,
      average: Math.round(total / chartData.length),
    };
  };

  const rangeMetrics = getFilteredMetrics();

  // Export downloads to CSV format
  const handleCSVExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Date,Downloads", ...chartData.map(h => `${h.day},${h.downloads}`)].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${pkgData.name}_downloads_range.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share URL helper
  const handleShareURL = () => {
    const shareUrl = `${window.location.origin}?package=${encodeURIComponent(pkgData.name)}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Copied shareable workspace URL to clipboard!");
  };

  const isFavorite = favorites.includes(pkgData.name);

  return (
    <div className="space-y-8 py-4 w-full min-w-0 overflow-x-hidden">
      
      {/* 1. Header & Search controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Dynamic Autocomplete Search Bar */}
        <div ref={searchRef} className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-zinc-400" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search another package... (Press '/' to focus)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                onSelectPackage(searchQuery.trim());
                setShowSuggestions(false);
              }
            }}
            className="block w-full pl-10 pr-10 py-2.5 text-sm rounded-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
          />
          {searchQuery && (
            <kbd className="absolute right-3.5 top-3 px-1.5 py-0.5 text-[10px] bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded font-mono hidden sm:inline-block">
              /
            </kbd>
          )}

          {/* Autocomplete Dropdown List */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 mt-2 w-full rounded-2xl shadow-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 max-h-80 overflow-y-auto backdrop-blur-md">
              <div className="p-2.5 border-b border-zinc-150 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Matches found
              </div>
              <div className="p-1 space-y-0.5">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      onSelectPackage(s.name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex flex-col transition-colors"
                  >
                    <span className="font-mono text-sm font-bold text-zinc-950 dark:text-white">{s.name}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate w-full mt-0.5">{s.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <button
            onClick={() => onToggleFavorite(pkgData.name)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
              isFavorite
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800/80'
            }`}
          >
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-white' : ''}`} />
            {isFavorite ? 'Bookmarked' : 'Bookmark'}
          </button>
          
          <button
            onClick={handleShareURL}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold shadow-sm transition-all"
          >
            Share Workspace
          </button>
        </div>
      </div>

      {/* 2. Package Title Hero Block */}
      <div className="p-6 md:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-sans font-extrabold text-zinc-950 dark:text-white tracking-tight break-words min-w-0">{pkgData.name}</h1>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40">
                v{pkgData.latestVersion}
              </span>
              {pkgData.security.isDeprecated && (
                <span className="px-2.5 py-0.5 text-[11px] font-sans font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Deprecated
                </span>
              )}
              {pkgData.health.metrics.typescript.value && (
                <span className="px-2.5 py-0.5 text-[11px] font-sans font-bold rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40">
                  TS Ready
                </span>
              )}
            </div>
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">{pkgData.description}</p>
            
            {/* Keywords */}
            {pkgData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {pkgData.keywords.slice(0, 10).map((kw) => (
                  <span
                    key={kw}
                    onClick={() => onSelectPackage(kw)}
                    className="text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 px-2 py-0.5 rounded cursor-pointer hover:border-indigo-500 hover:text-indigo-500 transition-all"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Links Panel */}
          <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0 pt-2">
            {pkgData.homepage && (
              <a
                href={pkgData.homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Info className="h-4 w-4" /> Homepage <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {pkgData.githubUrl && (
              <a
                href={pkgData.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <GitFork className="h-4 w-4" /> GitHub <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <a
              href={`https://www.npmjs.com/package/${pkgData.name}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Terminal className="h-4 w-4" /> NPM Registry <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. Global Ecosystem KPI Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3 sm:gap-4 items-stretch w-full min-w-0">
        <KpiStatCard
          label="Downloads Today"
          value={pkgData.downloads.today.toLocaleString()}
          title={pkgData.downloads.today.toLocaleString()}
          expanded={expandedKpi === 'downloads-today'}
          onExpand={() => setExpandedKpi('downloads-today')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="This Week"
          value={pkgData.downloads.lastWeek.toLocaleString()}
          title={pkgData.downloads.lastWeek.toLocaleString()}
          expanded={expandedKpi === 'downloads-week'}
          onExpand={() => setExpandedKpi('downloads-week')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="This Month"
          value={pkgData.downloads.lastMonth.toLocaleString()}
          title={pkgData.downloads.lastMonth.toLocaleString()}
          expanded={expandedKpi === 'downloads-month'}
          onExpand={() => setExpandedKpi('downloads-month')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="This Year"
          value={pkgData.downloads.lastYear.toLocaleString()}
          title={pkgData.downloads.lastYear.toLocaleString()}
          expanded={expandedKpi === 'downloads-year'}
          onExpand={() => setExpandedKpi('downloads-year')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="Health score"
          accent
          value={
            <>
              {pkgData.health.score}{' '}
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">/ 100</span>
            </>
          }
          fullValue={`${pkgData.health.score} / 100`}
          expanded={expandedKpi === 'health-score'}
          onExpand={() => setExpandedKpi('health-score')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="GitHub Stars"
          value={pkgData.github ? pkgData.github.stars.toLocaleString() : 'N/A'}
          title={pkgData.github ? pkgData.github.stars.toLocaleString() : 'N/A'}
          expanded={expandedKpi === 'github-stars'}
          onExpand={() => setExpandedKpi('github-stars')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="Total versions"
          value={pkgData.totalVersions}
          expanded={expandedKpi === 'total-versions'}
          onExpand={() => setExpandedKpi('total-versions')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="Last release"
          value={pkgData.lastUpdated ? pkgData.lastUpdated.split('T')[0] : 'N/A'}
          title={pkgData.lastUpdated ? pkgData.lastUpdated.split('T')[0] : 'N/A'}
          expanded={expandedKpi === 'last-release'}
          onExpand={() => setExpandedKpi('last-release')}
          onClose={() => setExpandedKpi(null)}
        />
        <KpiStatCard
          label="Repository Risk"
          value={repositoryRisk.level}
          title={`Repository Risk: ${repositoryRisk.level}`}
          expanded={expandedKpi === 'repository-risk'}
          onExpand={() => setExpandedKpi('repository-risk')}
          onClose={() => setExpandedKpi(null)}
        />
      </div>

      {/* 4. Sub-Section Navigation Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 sm:gap-6 w-max sm:w-full min-w-full">
        <button
          onClick={() => setActiveTabSection('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeTabSection === 'overview'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" /> Downloads & Health Overview
        </button>
        <button
          onClick={() => setActiveTabSection('insights')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeTabSection === 'insights'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Package Insights
        </button>
        <button
          onClick={() => setActiveTabSection('dependencies')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeTabSection === 'dependencies'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" /> Dependencies ({dependencyAudit.totalPackages || Object.keys(pkgData.dependencies).length})
        </button>
        <button
          onClick={() => setActiveTabSection('versions')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeTabSection === 'versions'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" /> Versions & Release Cadence
        </button>
        <button
          onClick={() => setActiveTabSection('security')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeTabSection === 'security'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> Publisher & Advisory Info
        </button>
        </div>
      </div>

      {/* 5. Tab Views */}
      
      {/* Tab A: Overview & Health */}
      {activeTabSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Download trends area chart (Lg spans 2) */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md flex flex-col justify-between">
            
            {/* Download chart toolbar controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Downloads Momentum</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Historical package popularity metrics.</p>
              </div>

              {/* Range select tools */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Fixed Ranges */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {['7', '30', '90', '365'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setTimeRange(r as any)}
                      className={`px-2 py-1 text-[11px] font-bold rounded ${
                        timeRange === r
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {r}d
                    </button>
                  ))}
                  <button
                    onClick={() => setTimeRange('custom')}
                    className={`px-2 py-1 text-[11px] font-bold rounded ${
                      timeRange === 'custom'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Moving average toggle */}
                <button
                  onClick={() => setShowMovingAverage(!showMovingAverage)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                    showMovingAverage
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  }`}
                  title="Toggle 7-day Simple Moving Average line"
                >
                  7d SMA
                </button>

                {/* Export downloads */}
                <button
                  onClick={handleCSVExport}
                  className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  title="Export statistical timeline to CSV file"
                >
                  <FileDown className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Custom Date selection sliders (Only visible if 'custom' range is active) */}
            {timeRange === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 mb-4 bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800 text-xs text-zinc-500">
                <span>Start Date:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 font-mono text-zinc-900 dark:text-white text-[11px]"
                />
                <span>End Date:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 font-mono text-zinc-900 dark:text-white text-[11px]"
                />
              </div>
            )}

            {/* Area Chart visualization */}
            <div className="h-72 w-full min-w-0 overflow-hidden mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedChartData}>
                  <defs>
                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" className="hidden dark:block" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(23, 23, 23, 0.95)', 
                      borderColor: '#3f3f46',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      fontSize: '11px'
                    }}
                  />
                  <Area type="monotone" dataKey="downloads" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorDownloads)" />
                  {showMovingAverage && (
                    <Line type="monotone" dataKey="sma" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="7d moving average" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick range statistics summary banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-900 text-xs">
              <div className="min-w-0">
                <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Total in Range</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 block truncate tabular-nums" title={rangeMetrics.total.toLocaleString()}>{rangeMetrics.total.toLocaleString()}</span>
              </div>
              <div className="min-w-0">
                <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Peak Downloads</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate tabular-nums" title={`Peak day: ${rangeMetrics.peak.day}`}>
                  {rangeMetrics.peak.downloads.toLocaleString()}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Lowest Day</span>
                <span className="font-mono font-bold text-rose-500 mt-0.5 block truncate tabular-nums" title={`Lowest day: ${rangeMetrics.lowest.day}`}>
                  {rangeMetrics.lowest.downloads.toLocaleString()}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Daily Average</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 block truncate tabular-nums" title={rangeMetrics.average.toLocaleString()}>{rangeMetrics.average.toLocaleString()}</span>
              </div>
            </div>

          </div>

          {/* Right Column: Health Score Audit Card */}
          <div className="space-y-6">
            
            {/* Health Meter Component */}
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Ecosystem Quality Rating</h3>
              <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4 mb-4">
                <div className="relative flex items-center justify-center">
                  {/* Circular visual border */}
                  <div className="h-16 w-16 rounded-full border-4 border-zinc-100 dark:border-zinc-900 flex items-center justify-center font-mono font-black text-xl text-indigo-600 dark:text-indigo-400">
                    {pkgData.health.score}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Overall score {pkgData.health.score >= 80 ? 'Excellent' : 'Moderate'}</span>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Rating weight based on activity, security, types and usage.</p>
                </div>
              </div>

              {/* Sub-metrics bars */}
              <div className="space-y-3.5">
                {Object.entries(pkgData.health.metrics).map(([key, metric]: [string, any]) => (
                  <div key={key} className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center gap-2 text-[11px] font-semibold min-w-0">
                      <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{metric.label}</span>
                      <span className="text-zinc-800 dark:text-zinc-200 truncate text-right">{typeof metric.value === 'boolean' ? (metric.value ? 'Fully supported' : 'Fallback') : metric.value}</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          metric.score >= 20 ? 'bg-indigo-600 dark:bg-indigo-500' :
                          metric.score >= 15 ? 'bg-teal-500' :
                          metric.score >= 10 ? 'bg-amber-500' :
                          'bg-rose-500'
                        }`}
                        style={{ width: `${(metric.score / (key === 'maintenance' || key === 'popularity' ? 25 : key === 'community' ? 20 : 15)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub Codebase Audit summary */}
            {pkgData.github ? (
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-900 pb-3">
                  <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <GitFork className="h-4 w-4 text-indigo-500" /> Codebase Repository
                  </h4>
                  <a
                    href={pkgData.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    GitHub page <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3.5 text-xs">
                  <div className="min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-lg border border-zinc-200/40 dark:border-zinc-800/40">
                    <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Watchers</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 block truncate tabular-nums">{pkgData.github.watchers.toLocaleString()}</span>
                  </div>
                  <div className="min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-lg border border-zinc-200/40 dark:border-zinc-800/40">
                    <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Forks</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white mt-0.5 block truncate tabular-nums">{pkgData.github.forks.toLocaleString()}</span>
                  </div>
                  <div className="min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 p-2 rounded-lg border border-zinc-200/40 dark:border-zinc-800/40 col-span-2">
                    <span className="text-zinc-400 dark:text-zinc-500 block leading-tight">Size & Default Branch</span>
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 mt-1 block truncate">
                      {Math.round(pkgData.github.size / 1024)} MB on branch <span className="text-indigo-500">"{pkgData.github.defaultBranch}"</span>
                    </span>
                  </div>
                </div>

                {/* GitHub Languages visual bar */}
                {Object.keys(pkgData.github.languages).length > 0 && (
                  <div className="space-y-2 pt-2 text-xs">
                    <span className="text-[11px] font-bold text-zinc-400">Language Breakdown</span>
                    <div className="flex w-full h-2 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-900">
                      {Object.entries(pkgData.github.languages).slice(0, 4).map(([lang, bytes], idx) => {
                        const colors = ['bg-indigo-500', 'bg-amber-400', 'bg-teal-400', 'bg-pink-500'];
                        const totalBytes = (Object.values(pkgData.github!.languages) as number[]).reduce((a: number, b: number) => a + b, 0);
                        const widthPct = ((bytes as number) / totalBytes) * 100;
                        return (
                          <div
                            key={lang}
                            className={colors[idx % colors.length]}
                            style={{ width: `${widthPct}%` }}
                            title={`${lang}: ${widthPct.toFixed(1)}%`}
                          />
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-500">
                      {Object.entries(pkgData.github.languages).slice(0, 4).map(([lang, bytes], idx) => {
                        const bulletColors = ['bg-indigo-500', 'bg-amber-400', 'bg-teal-400', 'bg-pink-500'];
                        const totalBytes = (Object.values(pkgData.github!.languages) as number[]).reduce((a: number, b: number) => a + b, 0);
                        return (
                          <div key={lang} className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${bulletColors[idx % bulletColors.length]}`} />
                            <span>{lang} ({(((bytes as number) / totalBytes) * 100).toFixed(0)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

          </div>

        </div>
      )}

      {/* Tab B: Package Insights */}
      {activeTabSection === 'insights' && (
        <PackageInsightsPanel pkgData={pkgData} />
      )}

      {/* Tab C: Dependencies Grid */}
      {activeTabSection === 'dependencies' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md">
            <DependencyTree
              packageName={pkgData.name}
              dependencies={pkgData.dependencies}
              devDependencies={pkgData.devDependencies}
              peerDependencies={pkgData.peerDependencies}
              optionalDependencies={pkgData.optionalDependencies}
              onSelectPackage={onSelectPackage}
            />
          </div>

          {dependencyAudit.tree.length > 0 && (
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                <GitFork className="h-4.5 w-4.5 text-indigo-500" /> Transitive Dependency Audit
              </h3>
              <TransitiveDependencyTree audit={dependencyAudit} onSelectPackage={onSelectPackage} />
            </div>
          )}
        </div>
      )}

      {/* Tab C: Versioning and Release timelines */}
      {activeTabSection === 'versions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Release timeline scroll panel (Lg spans 2) */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-indigo-500" /> Historical Release Timeline
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 mb-6">
              Listing of last 30 releases with interval gaps.
            </p>

            <div className="relative border-l-2 border-zinc-100 dark:border-zinc-800 pl-4 space-y-6 max-h-[480px] overflow-y-auto pr-2">
              {pkgData.versionsList.slice(0, 30).map((v) => {
                const isLatest = v.type === 'latest';
                const dateClean = v.publishDate ? v.publishDate.split('T')[0] : 'N/A';
                const bulletColor = 
                  isLatest ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-200 ring-2 ring-indigo-100 dark:ring-indigo-950/40' :
                  v.type === 'beta' || v.type === 'alpha' || v.type === 'rc' ? 'bg-amber-500 border-amber-200' :
                  'bg-zinc-300 dark:bg-zinc-700 border-zinc-100';

                return (
                  <div key={v.version} className="relative group">
                    {/* Circle Node bullet */}
                    <span className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 ${bulletColor}`} />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-zinc-950 dark:text-white">v{v.version}</span>
                        {isLatest && (
                          <span className="px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded text-[9px] font-semibold">
                            latest tags
                          </span>
                        )}
                        {(v.type === 'beta' || v.type === 'alpha' || v.type === 'rc') && (
                          <span className="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded text-[9px] font-semibold uppercase">
                            {v.type} release
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3.5 text-[10px] font-mono text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {dateClean}
                        </span>
                        {v.daysSincePrevious !== undefined && (
                          <span className="text-zinc-500 dark:text-zinc-400 font-sans">
                            (+{v.daysSincePrevious} days interval)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Semantic breakdown statistics */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Semantic Version (SemVer) Audit</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Distribution of recent releases by tags. Avoid pre-releases in production systems.
            </p>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex justify-between items-center py-2.5 border-b border-zinc-100 dark:border-zinc-900">
                <span className="text-zinc-500">Stable Releases</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  {pkgData.versionsList.filter(v => v.type === 'latest' || v.type === 'previous').length} active
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-zinc-100 dark:border-zinc-900">
                <span className="text-zinc-500">Pre-releases (beta/alpha)</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white">
                  {pkgData.versionsList.filter(v => v.type === 'beta' || v.type === 'alpha' || v.type === 'rc').length} found
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-zinc-500">Earliest listed version</span>
                <span className="font-mono text-zinc-400">
                  v{pkgData.versionsList[pkgData.versionsList.length - 1]?.version || 'N/A'}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab D: Security, Deprecations and Maintainers */}
      {activeTabSection === 'security' && (
        <div className="space-y-6">
          {/* Repository Risk */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-900 pb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="h-4.5 w-4.5 text-amber-500" /> Repository Risk
              </h3>
              <span className={`self-start sm:self-auto px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${repositoryRiskStyles(repositoryRisk.level).badge}`}>
                {repositoryRisk.level}
              </span>
            </div>

            <p className={`text-xs font-medium px-4 py-3 rounded-xl border ${repositoryRiskStyles(repositoryRisk.level).bg} ${repositoryRiskStyles(repositoryRisk.level).border} ${repositoryRiskStyles(repositoryRisk.level).text}`}>
              {repositoryRisk.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(repositoryRisk.factors).map(([key, factor]) => (
                <div
                  key={key}
                  className={`p-3.5 rounded-xl border text-xs ${
                    factor.triggered
                      ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20'
                      : 'border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{factor.label}</span>
                    {factor.triggered ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">{factor.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Publisher Information */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-5">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-4">
              <User className="h-4.5 w-4.5 text-indigo-500" /> Publisher Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Publisher</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-1 block truncate">{publisherInfo.publisher}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Organization</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-1 block truncate flex items-center gap-1.5">
                  {publisherInfo.organization ? (
                    <>
                      <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      {publisherInfo.organization}
                    </>
                  ) : (
                    'Unscoped package'
                  )}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Verified Publisher</span>
                <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  publisherInfo.verifiedPublisher
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {publisherInfo.verifiedPublisher ? (
                    <><BadgeCheck className="h-3 w-3" /> Yes</>
                  ) : (
                    'No'
                  )}
                </span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed">{publisherInfo.verifiedPublisherDetail}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Maintainer Count</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-1 block">{publisherInfo.maintainerCount}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">First Publish</span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 mt-1 block">{formatPublishDate(publisherInfo.firstPublish)}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Last Publish</span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 mt-1 block">{formatPublishDate(publisherInfo.lastPublish)}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 sm:col-span-2">
                <span className="text-zinc-400 dark:text-zinc-500 block text-[10px] font-bold uppercase tracking-wider">Packages Published</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white mt-1 block">
                  {publisherInfo.packagesPublished !== null
                    ? publisherInfo.packagesPublished.toLocaleString()
                    : 'N/A'}
                </span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                  {publisherInfo.organization
                    ? 'Total packages under this npm organization scope'
                    : 'Total packages where this publisher is listed as maintainer'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Maintainers</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                {publisherInfo.maintainers.map((m) => (
                  <div
                    key={m.name}
                    className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center gap-2.5"
                  >
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold font-sans text-xs uppercase shadow-sm shrink-0">
                      {m.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-zinc-950 dark:text-white block truncate">{m.name}</span>
                      {m.email && <span className="text-[10px] text-zinc-400 truncate block mt-0.5">{m.email}</span>}
                    </div>
                  </div>
                ))}
                {publisherInfo.maintainers.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-4 sm:col-span-2">No maintainers listed on the registry.</p>
                )}
              </div>
            </div>
          </div>

          <SecurityDeepDive pkgData={pkgData} />

          {(alternatives.length > 0 || security.hasSecurityAdvisories || pkgData.security.isDeprecated) && (
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-4">
                <TrendingUp className="h-4.5 w-4.5 text-indigo-500" /> Alternative Packages
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Suggested similar, lighter, or safer alternatives based on risk profile and ecosystem data.
              </p>
              <AlternativesPanel alternatives={alternatives} onSelectPackage={onSelectPackage} />
            </div>
          )}

        <div>
          {/* Advisory details */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md space-y-6">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-rose-500" /> Integrity & Deprecation status
            </h3>

            {pkgData.security.isDeprecated ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs">
                <div className="flex gap-2 text-rose-800 dark:text-rose-400 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> WARNING: DEPRECATED PACKAGE
                </div>
                <p className="text-rose-600 dark:text-rose-500 leading-relaxed font-semibold">
                  {pkgData.security.deprecationReason || "This package is no longer supported by its maintainer and should not be used in critical software."}
                </p>
              </div>
            ) : security.hasSecurityAdvisories ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs">
                <div className="flex gap-2 text-rose-800 dark:text-rose-400 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> SECURITY ADVISORIES FOUND
                </div>
                <p className="text-rose-600 dark:text-rose-500 leading-relaxed font-semibold">
                  {security.advisoriesCount} known {security.advisoriesCount === 1 ? 'advisory' : 'advisories'}
                  {security.highestSeverity ? ` — highest severity: ${security.highestSeverity}` : ''}.
                  {dependencyAudit.totalVulnerabilities > 0
                    ? ` ${dependencyAudit.totalVulnerabilities} vulnerable dependencies in the install tree.`
                    : ''}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-400 flex gap-2 font-medium">
                <CheckCircle className="h-4 w-4 shrink-0" /> Good integrity. Not deprecated
                {dependencyAudit.totalVulnerabilities > 0
                  ? `, but ${dependencyAudit.totalVulnerabilities} vulnerable dependencies found in the tree.`
                  : ' and no OSV advisories on the latest version.'}
              </div>
            )}

            <div className="space-y-3 pt-3 text-xs">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Maintenance Status Attributes</h4>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-900">
                <span className="text-zinc-500">Active maintenance</span>
                <span className={`px-2 py-0.5 font-bold rounded-full text-[10px] uppercase font-mono ${
                  pkgData.security.maintenanceStatus === 'active' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-zinc-150 text-zinc-500 dark:bg-zinc-900 text-zinc-400'
                }`}>
                  {pkgData.security.maintenanceStatus}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-500">Created date</span>
                <span className="font-mono font-medium text-zinc-800 dark:text-zinc-300">
                  {pkgData.publishDate ? pkgData.publishDate.split('T')[0] : 'N/A'}
                </span>
              </div>
            </div>
          </div>

        </div>
        </div>
      )}

    </div>
  );
}
