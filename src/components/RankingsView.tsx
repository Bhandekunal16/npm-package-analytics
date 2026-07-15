/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Award, 
  Star, 
  Download, 
  ArrowRight, 
  Compass,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface RankingsViewProps {
  onSelectPackage: (name: string) => void;
}

interface RankingItem {
  rank: number;
  name: string;
  description: string;
  downloads: number;
  growthPercent: number;
  category: string;
}

export default function RankingsView({ onSelectPackage }: RankingsViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankings, setRankings] = useState<{
    mostDownloaded: RankingItem[];
    trending: RankingItem[];
    topStarred: RankingItem[];
  } | null>(null);

  const [activeCategory, setActiveCategory] = useState<'mostDownloaded' | 'trending' | 'topStarred'>('mostDownloaded');

  useEffect(() => {
    async function loadRankings() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/rankings');
        if (!res.ok) {
          throw new Error('Failed to fetch global rankings.');
        }
        const data = await res.json();
        setRankings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRankings();
  }, []);

  if (loading) {
    return (
      <div className="py-12 space-y-8 animate-pulse">
        <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
          ))}
        </div>
        <div className="h-96 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl"></div>
      </div>
    );
  }

  if (error || !rankings) {
    return (
      <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/10">
        <Compass className="h-10 w-10 mx-auto text-rose-500 animate-spin" />
        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-4">Unable to Load Rankings</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-2">
          Rankings are warming up on the server. Please search for any package in the search bar or reload.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-md transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentList = rankings[activeCategory] || [];

  // Static Sparkline generator data for visuals
  const makeSparklineData = (grow: number, idx: number) => {
    const base = grow > 0 ? 50 : 80;
    const offset = idx % 2 === 0 ? 10 : -10;
    return [
      { v: base },
      { v: base + offset * 2 },
      { v: base + offset },
      { v: base + offset * 3 },
      { v: base + offset * 2 },
      { v: base + (grow > 0 ? 40 : -40) },
    ];
  };

  return (
    <div className="space-y-8 py-4">
      
      {/* Visual Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-sans font-extrabold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <Compass className="h-6 w-6 text-indigo-500" />
            NPM Global Rankings
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time analytics and momentum ratings for curated ecosystem standard packages.
          </p>
        </div>

        {/* Category Toggles */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveCategory('mostDownloaded')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === 'mostDownloaded'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-indigo-500" />
            Most Downloaded
          </button>
          <button
            onClick={() => setActiveCategory('trending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === 'trending'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            Trending / Growth
          </button>
          <button
            onClick={() => setActiveCategory('topStarred')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === 'topStarred'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Star className="h-3.5 w-3.5 text-amber-500" />
            Top Starred
          </button>
        </div>
      </div>

      {/* Rankings Data Grid */}
      <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-900/40 backdrop-blur-md overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6 text-center w-16">Rank</th>
                <th className="py-4 px-6">Package</th>
                <th className="py-4 px-6 text-right w-44">Weekly Downloads</th>
                <th className="py-4 px-6 text-center w-36">Growth Rate</th>
                <th className="py-4 px-6 text-center w-32">Momentum</th>
                <th className="py-4 px-6 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {currentList.map((item, index) => {
                const rankColor = 
                  item.rank === 1 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400' :
                  item.rank === 2 ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300' :
                  item.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-400' :
                  'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400';

                const sparkColor = item.growthPercent >= 0 ? '#10b981' : '#f43f5e';

                return (
                  <tr 
                    key={item.name} 
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors group cursor-pointer"
                    onClick={() => onSelectPackage(item.name)}
                  >
                    {/* Rank Badge */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-mono font-bold ${rankColor}`}>
                        {item.rank}
                      </span>
                    </td>

                    {/* Name and Description */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col min-w-0 max-w-sm md:max-w-md">
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-500 transition-colors">
                          {item.name}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                          {item.description}
                        </span>
                      </div>
                    </td>

                    {/* Downloads */}
                    <td className="py-4 px-6 text-right font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {item.downloads.toLocaleString()}
                    </td>

                    {/* Growth % */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold font-mono ${
                        item.growthPercent >= 0 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {item.growthPercent >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {item.growthPercent >= 0 ? '+' : ''}{item.growthPercent}%
                      </span>
                    </td>

                    {/* Trend Sparkline */}
                    <td className="py-3 px-6 text-center">
                      <div className="h-8 w-24 mx-auto opacity-70 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={makeSparklineData(item.growthPercent, index)}>
                            <Line 
                              type="monotone" 
                              dataKey="v" 
                              stroke={sparkColor} 
                              strokeWidth={1.5} 
                              dot={false} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>

                    {/* Click Action */}
                    <td className="py-4 px-6 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPackage(item.name);
                        }}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        title="Inspect package"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
