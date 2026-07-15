/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NPMFullPackageData, PackageComparisonMetrics } from './types';
import { resolveRepositoryRisk } from './packageDefaults';

export type CompareDirection = 'higher-better' | 'lower-better' | 'boolean-true-better' | 'boolean-false-better' | 'none';
export type CompareHighlight = 'best' | 'worst' | null;

export interface CompareRow {
  id: string;
  label: string;
  direction: CompareDirection;
  getNumericValue: (pkg: NPMFullPackageData, metrics: PackageComparisonMetrics) => number | null;
  format: (pkg: NPMFullPackageData, metrics: PackageComparisonMetrics) => string;
}

export function resolveComparisonMetrics(pkg: NPMFullPackageData): PackageComparisonMetrics {
  if (pkg.comparisonMetrics) {
    return pkg.comparisonMetrics;
  }

  const dependencyCount = Object.keys(pkg.dependencies || {}).length;
  const publishDays = pkg.publishDate
    ? Math.round((Date.now() - new Date(pkg.publishDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const lastPublishDays = pkg.lastUpdated
    ? Math.round((Date.now() - new Date(pkg.lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    bundleSizeBytes: null,
    packageSizeBytes: null,
    installSizeBytes: null,
    packageAgeDays: publishDays,
    repositoryActivityDays: pkg.github?.latestCommit?.date
      ? Math.round((Date.now() - new Date(pkg.github.latestCommit.date).getTime()) / (1000 * 60 * 60 * 24))
      : null,
    lastPublishDaysAgo: lastPublishDays,
    lastPublishDate: pkg.lastUpdated || '',
    contributorsCount: pkg.github?.contributorsCount ?? null,
    releaseFrequencyDays: null,
    dependencyCount,
    license: pkg.license || 'Proprietary',
    securityScore: pkg.health?.metrics?.security?.score ?? 0,
    maintenanceScore: pkg.health?.metrics?.maintenance?.score ?? 0,
    busFactor: null,
    treeShaking: null,
    hasSideEffects: null,
    supportsEsm: false,
    supportsCjs: true,
    hasFunding: false,
    fundingUrl: null,
  };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDays(days: number | null, suffix = 'ago'): string {
  if (days === null) return 'N/A';
  if (days === 0) return 'Today';
  if (days === 1) return `1 day ${suffix}`;
  if (days < 30) return `${days} days ${suffix}`;
  if (days < 365) return `${Math.round(days / 30)} mo ${suffix}`;
  const years = (days / 365).toFixed(1);
  return `${years} yr ${suffix}`;
}

function formatAge(days: number | null): string {
  if (days === null) return 'N/A';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

function formatBoolean(value: boolean | null, yes = 'Yes', no = 'No', unknown = 'Unknown'): string {
  if (value === null) return unknown;
  return value ? yes : no;
}

function riskLevelValue(pkg: NPMFullPackageData): number {
  const level = resolveRepositoryRisk(pkg).level;
  if (level === 'Low') return 0;
  if (level === 'Medium') return 1;
  return 2;
}

export const COMPARE_ROWS: CompareRow[] = [
  {
    id: 'health-score',
    label: 'Health Score',
    direction: 'higher-better',
    getNumericValue: (pkg) => pkg.health.score,
    format: (pkg) => `${pkg.health.score} / 100`,
  },
  {
    id: 'weekly-downloads',
    label: 'Weekly Downloads',
    direction: 'higher-better',
    getNumericValue: (pkg) => pkg.downloads.lastWeek,
    format: (pkg) => pkg.downloads.lastWeek.toLocaleString(),
  },
  {
    id: 'github-stars',
    label: 'GitHub Stars',
    direction: 'higher-better',
    getNumericValue: (pkg) => pkg.github?.stars ?? null,
    format: (pkg) => (pkg.github ? pkg.github.stars.toLocaleString() : 'N/A'),
  },
  {
    id: 'bundle-size',
    label: 'Bundle Size',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.bundleSizeBytes,
    format: (_pkg, metrics) => formatBytes(metrics.bundleSizeBytes),
  },
  {
    id: 'package-size',
    label: 'Package Size',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.packageSizeBytes,
    format: (_pkg, metrics) => formatBytes(metrics.packageSizeBytes),
  },
  {
    id: 'install-size',
    label: 'Install Size (est.)',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.installSizeBytes,
    format: (_pkg, metrics) => formatBytes(metrics.installSizeBytes),
  },
  {
    id: 'package-age',
    label: 'Package Age',
    direction: 'higher-better',
    getNumericValue: (_pkg, metrics) => metrics.packageAgeDays,
    format: (_pkg, metrics) => formatAge(metrics.packageAgeDays),
  },
  {
    id: 'repository-activity',
    label: 'Repository Activity',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.repositoryActivityDays,
    format: (_pkg, metrics) => formatDays(metrics.repositoryActivityDays, 'since last commit'),
  },
  {
    id: 'last-publish',
    label: 'Last Publish',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.lastPublishDaysAgo,
    format: (_pkg, metrics) => {
      if (!metrics.lastPublishDate) return 'N/A';
      return `${metrics.lastPublishDate.split('T')[0]} (${formatDays(metrics.lastPublishDaysAgo)})`;
    },
  },
  {
    id: 'contributors',
    label: 'Contributors',
    direction: 'higher-better',
    getNumericValue: (_pkg, metrics) => metrics.contributorsCount,
    format: (_pkg, metrics) =>
      metrics.contributorsCount !== null ? metrics.contributorsCount.toLocaleString() : 'N/A',
  },
  {
    id: 'release-frequency',
    label: 'Release Frequency',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.releaseFrequencyDays,
    format: (_pkg, metrics) =>
      metrics.releaseFrequencyDays !== null
        ? `Every ${metrics.releaseFrequencyDays} days`
        : 'N/A',
  },
  {
    id: 'dependency-count',
    label: 'Dependency Count',
    direction: 'lower-better',
    getNumericValue: (_pkg, metrics) => metrics.dependencyCount,
    format: (_pkg, metrics) => `${metrics.dependencyCount} direct`,
  },
  {
    id: 'license',
    label: 'License',
    direction: 'none',
    getNumericValue: () => null,
    format: (_pkg, metrics) => metrics.license,
  },
  {
    id: 'security-score',
    label: 'Security Score',
    direction: 'higher-better',
    getNumericValue: (_pkg, metrics) => metrics.securityScore,
    format: (_pkg, metrics) => `${metrics.securityScore} / 15`,
  },
  {
    id: 'maintenance-score',
    label: 'Maintenance Score',
    direction: 'higher-better',
    getNumericValue: (_pkg, metrics) => metrics.maintenanceScore,
    format: (_pkg, metrics) => `${metrics.maintenanceScore} / 25`,
  },
  {
    id: 'repository-risk',
    label: 'Repository Risk',
    direction: 'lower-better',
    getNumericValue: (pkg) => riskLevelValue(pkg),
    format: (pkg) => resolveRepositoryRisk(pkg).level,
  },
  {
    id: 'bus-factor',
    label: 'Bus Factor',
    direction: 'higher-better',
    getNumericValue: (_pkg, metrics) => metrics.busFactor,
    format: (_pkg, metrics) =>
      metrics.busFactor !== null ? `${metrics.busFactor} people` : 'N/A',
  },
  {
    id: 'tree-shaking',
    label: 'Tree Shaking',
    direction: 'boolean-true-better',
    getNumericValue: (_pkg, metrics) =>
      metrics.treeShaking === null ? null : metrics.treeShaking ? 1 : 0,
    format: (_pkg, metrics) => formatBoolean(metrics.treeShaking, 'Supported', 'Limited'),
  },
  {
    id: 'side-effects',
    label: 'Side Effects',
    direction: 'boolean-false-better',
    getNumericValue: (_pkg, metrics) =>
      metrics.hasSideEffects === null ? null : metrics.hasSideEffects ? 1 : 0,
    format: (_pkg, metrics) => formatBoolean(metrics.hasSideEffects, 'Declared', 'None'),
  },
  {
    id: 'esm',
    label: 'ESM',
    direction: 'boolean-true-better',
    getNumericValue: (_pkg, metrics) => (metrics.supportsEsm ? 1 : 0),
    format: (_pkg, metrics) => formatBoolean(metrics.supportsEsm, 'Yes', 'No'),
  },
  {
    id: 'cjs',
    label: 'CJS',
    direction: 'boolean-true-better',
    getNumericValue: (_pkg, metrics) => (metrics.supportsCjs ? 1 : 0),
    format: (_pkg, metrics) => formatBoolean(metrics.supportsCjs, 'Yes', 'No'),
  },
  {
    id: 'funding',
    label: 'Funding',
    direction: 'boolean-true-better',
    getNumericValue: (_pkg, metrics) => (metrics.hasFunding ? 1 : 0),
    format: (_pkg, metrics) =>
      metrics.hasFunding ? (metrics.fundingUrl ? 'Available' : 'Listed') : 'None',
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    direction: 'boolean-true-better',
    getNumericValue: (pkg) => (pkg.health.metrics.typescript.value ? 1 : 0),
    format: (pkg) => formatBoolean(pkg.health.metrics.typescript.value, 'Ready', 'Fallback'),
  },
];

export const METRIC_GROUPS: { title: string; ids: string[] }[] = [
  {
    title: 'Popularity',
    ids: ['health-score', 'weekly-downloads', 'github-stars'],
  },
  {
    title: 'Size',
    ids: ['bundle-size', 'package-size', 'install-size'],
  },
  {
    title: 'Activity',
    ids: ['package-age', 'repository-activity', 'last-publish', 'contributors', 'release-frequency'],
  },
  {
    title: 'Quality',
    ids: ['dependency-count', 'license', 'security-score', 'maintenance-score', 'repository-risk', 'bus-factor'],
  },
  {
    title: 'Module format',
    ids: ['tree-shaking', 'side-effects', 'esm', 'cjs'],
  },
  {
    title: 'Other',
    ids: ['funding', 'typescript'],
  },
];

const COMPARE_ROW_MAP = new Map(COMPARE_ROWS.map((row) => [row.id, row]));

export function getCompareRow(id: string): CompareRow | undefined {
  return COMPARE_ROW_MAP.get(id);
}

export function getMetricGroups() {
  return METRIC_GROUPS.map((group) => ({
    title: group.title,
    rows: group.ids
      .map((id) => getCompareRow(id))
      .filter((row): row is CompareRow => !!row),
  }));
}

export function getRowHighlights(
  packages: NPMFullPackageData[],
  row: CompareRow,
): CompareHighlight[] {
  if (row.direction === 'none' || packages.length < 2) {
    return packages.map(() => null);
  }

  const values = packages.map((pkg) => {
    const metrics = resolveComparisonMetrics(pkg);
    return row.getNumericValue(pkg, metrics);
  });

  const comparable = values
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null);

  if (comparable.length < 2) {
    return packages.map(() => null);
  }

  const sortMultiplier = row.direction === 'higher-better' ? -1 : 1;
  const sorted = [...comparable].sort((a, b) => (a.value - b.value) * sortMultiplier);
  const bestValue = sorted[0].value;
  const worstValue = sorted[sorted.length - 1].value;

  if (bestValue === worstValue) {
    return packages.map(() => null);
  }

  return values.map((value) => {
    if (value === null) return null;
    if (value === bestValue) return 'best';
    if (value === worstValue) return 'worst';
    return null;
  });
}

export function highlightClass(highlight: CompareHighlight): string {
  if (highlight === 'best') {
    return 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40';
  }
  if (highlight === 'worst') {
    return 'text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-200/60 dark:ring-rose-900/40';
  }
  return 'text-zinc-800 dark:text-zinc-200';
}
