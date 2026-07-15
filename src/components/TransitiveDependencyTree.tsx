/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, GitFork } from 'lucide-react';
import { DependencyAudit, DependencyTreeNode } from '../types';

interface TransitiveDependencyTreeProps {
  audit: DependencyAudit;
  onSelectPackage: (name: string) => void;
}

function severityClass(severity: string): string {
  const upper = severity.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH') return 'text-rose-700 dark:text-rose-400';
  if (upper === 'MODERATE') return 'text-amber-700 dark:text-amber-400';
  return 'text-zinc-600 dark:text-zinc-400';
}

function TreeNode({
  node,
  onSelectPackage,
}: {
  node: DependencyTreeNode;
  onSelectPackage: (name: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(node.depth <= 1);
  const hasChildren = node.children.length > 0;

  return (
    <div className="ml-3 border-l border-zinc-200 dark:border-zinc-800 pl-3">
      <div className="flex items-center gap-2 py-1">
        {hasChildren ? (
          <button onClick={() => setOpen(!open)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <button
          onClick={() => onSelectPackage(node.name)}
          className={`text-[11px] font-mono hover:underline ${node.vulnerable ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-zinc-800 dark:text-zinc-200'}`}
        >
          {node.name}@{node.version}
        </button>
        <span className="text-[10px] text-zinc-400 uppercase">{node.type}</span>
        {node.vulnerable && <AlertTriangle className="h-3 w-3 text-rose-500" />}
      </div>
      {open &&
        node.children.map((child) => (
          <div key={`${child.name}-${child.depth}`}>
            <TreeNode node={child} onSelectPackage={onSelectPackage} />
          </div>
        ))}
    </div>
  );
}

export default function TransitiveDependencyTree({ audit, onSelectPackage }: TransitiveDependencyTreeProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Total packages</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit.totalPackages}</span>
        </div>
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Max depth</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit.maxDepth}</span>
        </div>
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Duplicates</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-white">{audit.duplicateCount}</span>
        </div>
        <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-zinc-400 block text-[10px] uppercase">Vulnerabilities</span>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{audit.totalVulnerabilities}</span>
        </div>
      </div>

      {audit.vulnerabilities.length > 0 && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 overflow-hidden">
          <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/30 text-xs font-bold text-rose-700 dark:text-rose-400">
            Vulnerability scan — {audit.directVulnerable} direct, {audit.transitiveVulnerable} transitive
          </div>
          <div className="divide-y divide-rose-100 dark:divide-rose-900/30 max-h-48 overflow-y-auto">
            {audit.vulnerabilities.map((vuln, idx) => (
              <div key={`${vuln.id}-${idx}`} className="px-3 py-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{vuln.packageName}</span>
                  <span className={`font-bold uppercase ${severityClass(vuln.severity)}`}>{vuln.severity}</span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">{vuln.summary}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono truncate">
                  {vuln.isDirect ? 'direct' : 'transitive'} · {vuln.path.join(' → ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.duplicatePackages.length > 0 && (
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Duplicate packages:{' '}
          {audit.duplicatePackages.map((d) => `${d.name} (×${d.count})`).join(', ')}
        </div>
      )}

      <div className="rounded-lg border border-zinc-100 dark:border-zinc-900 p-3 max-h-72 overflow-y-auto">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <GitFork className="h-3.5 w-3.5" /> Transitive tree (depth {audit.maxDepth})
        </h4>
        {audit.tree.length === 0 ? (
          <p className="text-xs text-zinc-400">No dependency tree available.</p>
        ) : (
          audit.tree.map((node) => (
            <div key={`${node.name}-${node.type}`}>
              <TreeNode node={node} onSelectPackage={onSelectPackage} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
