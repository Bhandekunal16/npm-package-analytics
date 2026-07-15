/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NPMFullPackageData, PublisherInformation, RepositoryRisk } from './types';

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
