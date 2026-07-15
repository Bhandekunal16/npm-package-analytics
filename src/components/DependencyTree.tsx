/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  GitFork, 
  Search, 
  Cpu, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown,
  Layers
} from 'lucide-react';

interface DependencyTreeProps {
  packageName: string;
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  peerDependencies: { [key: string]: string };
  optionalDependencies: { [key: string]: string };
  onSelectPackage: (name: string) => void;
}

export default function DependencyTree({
  packageName,
  dependencies = {},
  devDependencies = {},
  peerDependencies = {},
  optionalDependencies = {},
  onSelectPackage,
}: DependencyTreeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState<{ [key: string]: boolean }>({
    prod: true,
    dev: false,
    peer: false,
    opt: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const prodCount = Object.keys(dependencies).length;
  const devCount = Object.keys(devDependencies).length;
  const peerCount = Object.keys(peerDependencies).length;
  const optCount = Object.keys(optionalDependencies).length;
  const totalCount = prodCount + devCount + peerCount + optCount;

  const filterDeps = (depsObj: { [key: string]: string }) => {
    return Object.entries(depsObj).filter(([name]) =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredProd = filterDeps(dependencies);
  const filteredDev = filterDeps(devDependencies);
  const filteredPeer = filterDeps(peerDependencies);
  const filteredOpt = filterDeps(optionalDependencies);

  const renderDepList = (
    title: string,
    list: [string, string][],
    count: number,
    sectionKey: string,
    colorClass: string,
    tagLabel: string
  ) => {
    const isExpanded = expandedSection[sectionKey];
    if (count === 0) return null;

    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 flex items-center justify-between text-left font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-sans font-bold text-zinc-900 dark:text-white">{title}</span>
            <span className={`text-[11px] px-2 py-0.5 font-mono rounded-full font-semibold ${colorClass}`}>
              {list.length} / {count} {tagLabel}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            {list.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No matching dependencies found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {list.map(([name, version]) => (
                  <div
                    key={name}
                    className="group flex items-center justify-between p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950/40 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-500 group-hover:border-indigo-500/30 transition-all">
                        <GitFork className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectPackage(name)}
                          className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate block text-left"
                        >
                          {name}
                        </button>
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                          Range: {version}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectPackage(name)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                      title="Inspect Dependency"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" /> Dependency Graph Metrics
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Total of <span className="font-mono font-bold text-zinc-900 dark:text-white">{totalCount}</span> direct modules are referenced by <span className="font-mono text-indigo-500">{packageName}</span>.
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search dependencies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 placeholder-zinc-400 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/10">
          <Cpu className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-700" />
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-2">No Dependencies</h4>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            This package runs stand-alone without external dependencies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {renderDepList(
            'Direct Dependencies',
            filteredProd,
            prodCount,
            'prod',
            'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950',
            'prod'
          )}

          {renderDepList(
            'Dev Dependencies',
            filteredDev,
            devCount,
            'dev',
            'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-950',
            'dev'
          )}

          {renderDepList(
            'Peer Dependencies',
            filteredPeer,
            peerCount,
            'peer',
            'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-950',
            'peer'
          )}

          {renderDepList(
            'Optional Dependencies',
            filteredOpt,
            optCount,
            'opt',
            'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700',
            'opt'
          )}
        </div>
      )}
    </div>
  );
}
