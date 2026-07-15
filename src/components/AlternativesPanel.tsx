/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lightbulb, ArrowRight, Shield, TrendingUp, Package } from 'lucide-react';
import { PackageAlternative } from '../types';

interface AlternativesPanelProps {
  alternatives: PackageAlternative[];
  onSelectPackage: (name: string) => void;
}

function reasonMeta(reason: PackageAlternative['reason']) {
  if (reason === 'safer') return { icon: Shield, label: 'Safer alternative', color: 'text-emerald-600 dark:text-emerald-400' };
  if (reason === 'morePopular') return { icon: TrendingUp, label: 'More popular', color: 'text-indigo-600 dark:text-indigo-400' };
  if (reason === 'lighter') return { icon: Package, label: 'Lighter option', color: 'text-amber-600 dark:text-amber-400' };
  return { icon: Lightbulb, label: 'Similar package', color: 'text-zinc-600 dark:text-zinc-400' };
}

export default function AlternativesPanel({ alternatives, onSelectPackage }: AlternativesPanelProps) {
  if (alternatives.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 text-center">
        No alternative suggestions found for this package.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {alternatives.map((alt) => {
        const meta = reasonMeta(alt.reason);
        const Icon = meta.icon;
        return (
          <button
            key={alt.name}
            onClick={() => onSelectPackage(alt.name)}
            className="text-left p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 hover:border-indigo-500/40 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {alt.name}
                </span>
                <p className={`text-[10px] font-semibold mt-1 flex items-center gap-1 ${meta.color}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-indigo-500 shrink-0" />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">{alt.description}</p>
          </button>
        );
      })}
    </div>
  );
}
