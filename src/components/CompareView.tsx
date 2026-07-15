/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  GitCompare,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { NPMFullPackageData } from '../types';
import {
  COMPARE_ROWS,
  getRowHighlights,
  highlightClass,
  resolveComparisonMetrics,
} from '../compareMetrics';

interface CompareViewProps {
  onSelectPackage: (name: string) => void;
  favorites: string[];
}

export default function CompareView({ onSelectPackage, favorites }: CompareViewProps) {
  const [inputVal, setInputVal] = useState('');
  const [comparedPkgs, setComparedPkgs] = useState<NPMFullPackageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreset = async (pkgs: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all(
        pkgs.map(async (name) => {
          const res = await fetch(`/api/package/${encodeURIComponent(name)}`);
          if (res.ok) {
            return await res.json();
          }
          throw new Error(`Failed to load ${name}`);
        }),
      );
      setComparedPkgs(responses);
    } catch (err: any) {
      setError(`Failed to load comparative preset: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addPackage = async (name: string) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    if (comparedPkgs.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
      setError('Package is already added to comparison.');
      return;
    }
    if (comparedPkgs.length >= 4) {
      setError('You can compare a maximum of 4 packages.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/package/${encodeURIComponent(cleanName)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Package "${cleanName}" not found on npm.`);
        }
        throw new Error('Server returned error while fetching comparative package.');
      }
      const data = await res.json();
      setComparedPkgs((prev) => [...prev, data]);
      setInputVal('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePackage = (index: number) => {
    setComparedPkgs((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const getCombinedChartData = () => {
    if (comparedPkgs.length === 0) return [];

    const daysCount = 30;
    const chartData: any[] = [];
    const sampleHistory = comparedPkgs[0].downloads.history || [];
    const last30Days = sampleHistory.slice(-daysCount);

    last30Days.forEach((dayEntry, idx) => {
      const dateIndex = sampleHistory.length - daysCount + idx;
      const dataPoint: any = { date: dayEntry.day };

      comparedPkgs.forEach((pkg) => {
        const pkgHistory = pkg.downloads.history || [];
        const match = pkgHistory[dateIndex] || pkgHistory.find((h) => h.day === dayEntry.day);
        dataPoint[pkg.name] = match ? match.downloads : 0;
      });

      chartData.push(dataPoint);
    });

    return chartData;
  };

  const chartData = getCombinedChartData();
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-sans font-extrabold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <GitCompare className="h-6 w-6 text-indigo-500" />
            Package Comparison
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Side-by-side metrics across size, activity, security, maintenance, and module format. Best values are green; worst are red.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400">Battle Presets:</span>
          <button
            onClick={() => loadPreset(['react', 'vue', 'angular', 'svelte'])}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all border border-zinc-200 dark:border-zinc-800"
          >
            UI Frameworks
          </button>
          <button
            onClick={() => loadPreset(['express', 'nestjs', 'fastify'])}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all border border-zinc-200 dark:border-zinc-800"
          >
            Node Servers
          </button>
          <button
            onClick={() => loadPreset(['lodash', 'ramda', 'underscore'])}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all border border-zinc-200 dark:border-zinc-800"
          >
            Utility Libraries
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md">
        <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">Add package to compare list (max 4)</h3>
        <div className="flex gap-2.5 max-w-lg">
          <input
            type="text"
            placeholder="e.g. lodash, zustand, typescript"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addPackage(inputVal);
            }}
            className="block flex-1 rounded-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          <button
            onClick={() => addPackage(inputVal)}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-400 text-white font-medium text-sm rounded-full shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-500 dark:text-rose-400 mt-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2.5 mt-5">
          {comparedPkgs.map((pkg, idx) => (
            <div
              key={pkg.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200/60 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 shadow-sm"
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[idx] }} />
              <span className="font-mono text-xs font-bold">{pkg.name}</span>
              <span className="text-[10px] bg-indigo-100/60 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                {pkg.latestVersion}
              </span>
              <button
                onClick={() => removePackage(idx)}
                className="text-indigo-400 hover:text-indigo-700 dark:hover:text-white p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {comparedPkgs.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">No packages added. Load a battle preset or add manually above.</p>
          )}
        </div>
      </div>

      {comparedPkgs.length > 0 && (
        <>
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Comparative Download Trajectory</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">30-day download frequency across chosen packages.</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" className="hidden dark:block" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                    tickFormatter={(val) =>
                      val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(23, 23, 23, 0.95)',
                      borderColor: '#3f3f46',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  {comparedPkgs.map((pkg, idx) => (
                    <Line
                      key={pkg.name}
                      type="monotone"
                      dataKey={pkg.name}
                      stroke={colors[idx]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-900/40 backdrop-blur-md overflow-hidden shadow-lg">
            <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-4 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Best value
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Worst value
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-6 w-56 sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-sm">Metric</th>
                    {comparedPkgs.map((pkg) => (
                      <th key={pkg.name} className="py-4 px-4 text-center min-w-[140px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[150px]">{pkg.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {pkg.latestVersion}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40 text-xs">
                  {COMPARE_ROWS.map((row) => {
                    const highlights = getRowHighlights(comparedPkgs, row);
                    return (
                      <tr key={row.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                        <td className="py-3.5 px-6 font-semibold text-zinc-700 dark:text-zinc-300 sticky left-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
                          {row.label}
                        </td>
                        {comparedPkgs.map((pkg, pkgIndex) => {
                          const metrics = resolveComparisonMetrics(pkg);
                          const display = row.format(pkg, metrics);
                          return (
                            <td key={pkg.name} className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-mono text-[11px] ${highlightClass(highlights[pkgIndex])}`}
                              >
                                {display}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  <tr className="hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                    <td className="py-3.5 px-6 font-semibold text-zinc-700 dark:text-zinc-300 sticky left-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
                      Open Dashboard
                    </td>
                    {comparedPkgs.map((pkg) => (
                      <td key={pkg.name} className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onSelectPackage(pkg.name)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all"
                        >
                          Analyze
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
