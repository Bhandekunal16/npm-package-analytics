/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Maintainer {
  name: string;
  email?: string;
  url?: string;
}

export interface Author {
  name: string;
  email?: string;
  url?: string;
}

export interface PackageVersion {
  version: string;
  publishDate: string;
  daysSincePrevious?: number;
  type: 'latest' | 'previous' | 'beta' | 'alpha' | 'rc' | 'other';
}

export interface SecurityStatus {
  isDeprecated: boolean;
  deprecationReason?: string;
  maintenanceStatus: 'active' | 'inactive' | 'deprecated';
  hasSecurityAdvisories: boolean;
  advisoriesCount: number;
}

export type RepositoryRiskLevel = 'Low' | 'Medium' | 'High';

export interface RepositoryRiskFactor {
  label: string;
  triggered: boolean;
  detail: string;
}

export interface RepositoryRisk {
  level: RepositoryRiskLevel;
  factors: {
    busFactor: RepositoryRiskFactor;
    inactiveMaintainers: RepositoryRiskFactor;
    archivedRepository: RepositoryRiskFactor;
    staleIssues: RepositoryRiskFactor;
    noReleases: RepositoryRiskFactor;
    lowContributorCount: RepositoryRiskFactor;
    noDocumentation: RepositoryRiskFactor;
  };
  summary: string;
}

export interface PublisherInformation {
  publisher: string;
  maintainers: Maintainer[];
  organization: string | null;
  verifiedPublisher: boolean;
  verifiedPublisherDetail: string;
  maintainerCount: number;
  firstPublish: string;
  lastPublish: string;
  packagesPublished: number | null;
}

export interface PackageHealth {
  score: number;
  metrics: {
    maintenance: { score: number; label: string; value: string };
    popularity: { score: number; label: string; value: string };
    typescript: { score: number; label: string; value: boolean };
    community: { score: number; label: string; value: string };
    security: { score: number; label: string; value: string };
  };
}

export interface GitHubStats {
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  closedIssues?: number;
  contributorsCount?: number;
  size: number;
  defaultBranch: string;
  languages: { [key: string]: number };
  latestCommit?: {
    sha: string;
    message: string;
    date: string;
    author: string;
  };
}

export interface DownloadDay {
  day: string;
  downloads: number;
}

export interface DownloadAnalytics {
  today: number;
  lastWeek: number;
  lastMonth: number;
  lastYear: number;
  averageDaily: number;
  growthPercent: number;
  peakDay: { day: string; downloads: number };
  lowestDay: { day: string; downloads: number };
  history: DownloadDay[];
}

export interface PackageComparisonMetrics {
  bundleSizeBytes: number | null;
  packageSizeBytes: number | null;
  installSizeBytes: number | null;
  packageAgeDays: number | null;
  repositoryActivityDays: number | null;
  lastPublishDaysAgo: number | null;
  lastPublishDate: string;
  contributorsCount: number | null;
  releaseFrequencyDays: number | null;
  dependencyCount: number;
  license: string;
  securityScore: number;
  maintenanceScore: number;
  busFactor: number | null;
  treeShaking: boolean | null;
  hasSideEffects: boolean | null;
  supportsEsm: boolean;
  supportsCjs: boolean;
  hasFunding: boolean;
  fundingUrl: string | null;
}

export interface NPMFullPackageData {
  name: string;
  description: string;
  latestVersion: string;
  author?: Author;
  license?: string;
  homepage?: string;
  githubUrl?: string;
  keywords: string[];
  publishDate: string;
  lastUpdated: string;
  totalVersions: number;
  maintainers: Maintainer[];
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
  peerDependencies: { [key: string]: string };
  optionalDependencies: { [key: string]: string };
  versionsList: PackageVersion[];
  downloads: DownloadAnalytics;
  github?: GitHubStats;
  health: PackageHealth;
  security: SecurityStatus;
  repositoryRisk: RepositoryRisk;
  publisherInfo: PublisherInformation;
  comparisonMetrics: PackageComparisonMetrics;
}

export interface RankingItem {
  rank: number;
  name: string;
  description: string;
  downloads: number;
  growthPercent: number;
  category: string;
}

export interface SearchResult {
  name: string;
  description: string;
  version: string;
  date: string;
  keywords?: string[];
  publisher?: Maintainer;
}
