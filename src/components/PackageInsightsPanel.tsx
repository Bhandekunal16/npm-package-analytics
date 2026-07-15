/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { NPMFullPackageData } from '../types';
import { resolveRepositoryRisk } from '../packageDefaults';
import { getMetricGroups, resolveComparisonMetrics } from '../compareMetrics';

interface PackageInsightsPanelProps {
  pkgData: NPMFullPackageData;
}

function valueTone(rowId: string, display: string, pkg: NPMFullPackageData): string {
  if (rowId === 'repository-risk') {
    const level = resolveRepositoryRisk(pkg).level;
    if (level === 'Low') return 'text-emerald-700 dark:text-emerald-400';
    if (level === 'Medium') return 'text-amber-700 dark:text-amber-400';
    return 'text-rose-700 dark:text-rose-400';
  }

  if (['tree-shaking', 'esm', 'cjs', 'typescript', 'funding'].includes(rowId)) {
    if (display === 'Yes' || display === 'Supported' || display === 'Ready' || display === 'Available' || display === 'Listed') {
      return 'text-emerald-700 dark:text-emerald-400';
    }
    if (display === 'No' || display === 'Limited' || display === 'Fallback' || display === 'None') {
      return 'text-zinc-500 dark:text-zinc-400';
    }
  }

  if (rowId === 'side-effects') {
    return display === 'None' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400';
  }

  return 'text-zinc-900 dark:text-white';
}

export default function PackageInsightsPanel({ pkgData }: PackageInsightsPanelProps) {
  const metrics = resolveComparisonMetrics(pkgData);
  const groups = getMetricGroups();

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 backdrop-blur-md shadow-md overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm md:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500 shrink-0" />
            Package Insights
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            Metrics for <span className="font-mono">{pkgData.name}</span>
          </p>
        </div>
      </div>

      <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        {groups.map((group) => (
          <section key={group.title} className="min-w-0">
            <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              {group.title}
            </h4>

            <dl className="rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/20 divide-y divide-zinc-100 dark:divide-zinc-900">
              {group.rows.map((row) => {
                const display = row.format(pkgData, metrics);
                return (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 px-3 py-2 md:py-1.5"
                  >
                    <dt className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                      {row.label}
                    </dt>
                    <dd
                      className={`text-[11px] md:text-xs font-mono font-semibold text-right break-words ${valueTone(row.id, display, pkgData)}`}
                    >
                      {display}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
