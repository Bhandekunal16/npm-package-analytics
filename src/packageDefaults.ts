/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BundleSizeInfo,
  DependencyAudit,
  NPMFullPackageData,
  PackageAlternative,
  PublisherInformation,
  RepositoryRisk,
  SecurityStatus,
} from './types';

const EMPTY_DEPENDENCY_AUDIT: DependencyAudit = {
  totalPackages: 0,
  maxDepth: 0,
  duplicateCount: 0,
  duplicatePackages: [],
  directVulnerable: 0,
  transitiveVulnerable: 0,
  totalVulnerabilities: 0,
  vulnerabilities: [],
  tree: [],
};

const NO_GITHUB_RISK_FACTORS: RepositoryRisk['factors'] = {
  busFactor: { label: 'Bus factor', triggered: false, detail: 'No GitHub repository linked' },
  inactiveMaintainers: { label: 'Inactive maintainers', triggered: false, detail: 'No GitHub repository linked' },
  archivedRepository: { label: 'Archived repository', triggered: false, detail: 'No GitHub repository linked' },
  staleIssues: { label: 'Too many stale issues', triggered: false, detail: 'No GitHub repository linked' },
  noReleases: { label: 'No releases', triggered: false, detail: 'No GitHub repository linked' },
  lowContributorCount: { label: 'Low contributor count', triggered: false, detail: 'No GitHub repository linked' },
  noDocumentation: { label: 'No documentation', triggered: false, detail: 'No GitHub repository linked' },
};

export function resolvePublisherInfo(pkg: NPMFullPackageData): PublisherInformation {
  if (pkg.publisherInfo) {
    return pkg.publisherInfo;
  }

  const maintainers = pkg.maintainers || [];
  const organization =
    pkg.name.startsWith('@') && pkg.name.includes('/') ? pkg.name.split('/')[0] : null;

  return {
    publisher: maintainers[0]?.name || pkg.author?.name || 'Unknown',
    maintainers,
    organization,
    verifiedPublisher: false,
    verifiedPublisherDetail: 'Publisher details unavailable — reload the package to refresh',
    maintainerCount: maintainers.length,
    firstPublish: pkg.publishDate || '',
    lastPublish: pkg.lastUpdated || '',
    packagesPublished: null,
  };
}

export function resolveRepositoryRisk(pkg: NPMFullPackageData): RepositoryRisk {
  if (pkg.repositoryRisk) {
    return pkg.repositoryRisk;
  }

  return {
    level: 'Medium',
    factors: NO_GITHUB_RISK_FACTORS,
    summary: 'Repository risk data unavailable — reload the package to refresh',
  };
}

export function resolveBundleSize(pkg: NPMFullPackageData): BundleSizeInfo {
  if (pkg.bundleSize) {
    return pkg.bundleSize;
  }

  return {
    minifiedBytes: pkg.comparisonMetrics?.bundleSizeBytes ?? null,
    gzipBytes: null,
    dependencyCount: null,
    source: 'registry',
  };
}

export function resolveDependencyAudit(pkg: NPMFullPackageData): DependencyAudit {
  return pkg.dependencyAudit || EMPTY_DEPENDENCY_AUDIT;
}

export function resolveAlternatives(pkg: NPMFullPackageData): PackageAlternative[] {
  return pkg.alternatives || [];
}

export function resolveSecurity(pkg: NPMFullPackageData): SecurityStatus {
  if (pkg.security?.advisories) {
    return pkg.security;
  }

  return {
    isDeprecated: pkg.security?.isDeprecated ?? false,
    deprecationReason: pkg.security?.deprecationReason,
    maintenanceStatus: pkg.security?.maintenanceStatus ?? 'inactive',
    hasSecurityAdvisories: pkg.security?.hasSecurityAdvisories ?? false,
    advisoriesCount: pkg.security?.advisoriesCount ?? 0,
    advisories: [],
    highestSeverity: pkg.security?.highestSeverity,
  };
}
