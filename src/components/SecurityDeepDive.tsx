/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { NPMFullPackageData } from '../types';
import { formatBytes, resolveComparisonMetrics } from '../compareMetrics';
import { resolveDependencyAudit, resolveSecurity } from '../packageDefaults';

interface SecurityDeepDiveProps {
  pkgData: NPMFullPackageData;
}

function severityBadge(severity: string) {
  const upper = severity.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400';
  }
  if (upper === 'MODERATE') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
  }
  return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
}

export default function SecurityDeepDive({ pkgData }: SecurityDeepDiveProps) {
  const advisories = resolveSecurity(pkgData).advisories;
  const audit = resolveDependencyAudit(pkgData);
  const bundle = pkgData.bundleSize;
  const metrics = resolveComparisonMetrics(pkgData);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Bundle (minified)</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-white">
            {formatBytes(bundle?.minifiedBytes ?? metrics.bundleSizeBytes)}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">{bundle?.source || 'registry'}</span>
        </div>
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Gzip size</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-white">
            {formatBytes(bundle?.gzipBytes)}
          </span>
        </div>
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Advisories</span>
          <span className={`font-mono font-bold ${advisories.length ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {advisories.length}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Security Advisories (OSV)</h4>
        </div>
        {advisories.length === 0 ? (
          <p className="px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
            No known CVEs or advisories for this package version.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900 max-h-56 overflow-y-auto">
            {advisories.map((adv) => (
              <div key={adv.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{adv.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${severityBadge(adv.severity)}`}>
                    {adv.severity}
                  </span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">{adv.summary}</p>
                {adv.affectedVersions.length > 0 && (
                  <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                    Affects: {adv.affectedVersions.slice(0, 5).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Dependency Vulnerability Scan</h4>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase">Direct vuln.</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit?.directVulnerable ?? 0}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase">Transitive vuln.</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit?.transitiveVulnerable ?? 0}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase">Packages scanned</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit?.totalPackages ?? 0}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase">Total findings</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{audit?.totalVulnerabilities ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
