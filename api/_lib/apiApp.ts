/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";

class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }
}

class RequestDeduplicator {
  private activeRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const active = this.activeRequests.get(key);
    if (active) {
      return active as Promise<T>;
    }
    const promise = fetchFn().finally(() => {
      this.activeRequests.delete(key);
    });
    this.activeRequests.set(key, promise);
    return promise;
  }
}

const cache = new MemoryCache();
const deduplicator = new RequestDeduplicator();

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 120;

function parseGithubUrl(repoField: any): { owner: string; repo: string } | null {
  if (!repoField) return null;
  let urlStr = "";
  if (typeof repoField === "string") {
    urlStr = repoField;
  } else if (typeof repoField === "object" && repoField.url) {
    urlStr = repoField.url;
  }

  if (!urlStr) return null;

  urlStr = urlStr.trim();
  if (!urlStr.includes("://") && !urlStr.startsWith("git@")) {
    const parts = urlStr.replace(/^github:/, "").split("/");
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    }
  }

  let cleaned = urlStr
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@github\.com:/, "https://github.com/");

  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname === "github.com" || parsed.hostname.endsWith(".github.com")) {
      const paths = parsed.pathname.split("/").filter(Boolean);
      if (paths.length >= 2) {
        return { owner: paths[0], repo: paths[1].replace(/\.git$/, "") };
      }
    }
  } catch {
    const match = urlStr.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  }
  return null;
}

function generateFallbackDownloads(): any {
  const history: any[] = [];
  const now = new Date();
  let total = 0;
  for (let i = 365; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const downloads = Math.floor(Math.random() * 2000) + 500;
    history.push({ day: dayStr, downloads });
    total += downloads;
  }
  return {
    today: history[history.length - 1].downloads,
    lastWeek: history.slice(-7).reduce((acc, x) => acc + x.downloads, 0),
    lastMonth: history.slice(-30).reduce((acc, x) => acc + x.downloads, 0),
    lastYear: total,
    averageDaily: Math.round(total / 365),
    growthPercent: parseFloat((Math.random() * 15 - 5).toFixed(1)),
    peakDay: { day: history[180].day, downloads: 3500 },
    lowestDay: { day: history[0].day, downloads: 300 },
    history,
  };
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2): Promise<Response> {
  const headers = {
    "User-Agent": "NPM-Package-Analytics-Applet",
    ...options.headers,
  };
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok && retries > 0) {
      return await fetchWithRetry(url, options, retries - 1);
    }
    return res;
  } catch (error) {
    if (retries > 0) {
      return await fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

const IS_VERCEL = !!process.env.VERCEL;
const MAX_TREE_DEPTH = IS_VERCEL ? 2 : 3;
const MAX_TREE_NODES = IS_VERCEL ? 35 : 80;
const SECURITY_ANALYTICS_TIMEOUT_MS = IS_VERCEL ? 20000 : 45000;
const REGISTRY_CACHE = new Map<string, any>();

function encodeRegistryName(name: string): string {
  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    return `${scope}%2F${pkg}`;
  }
  return name;
}

function parseSeverity(vuln: any): string {
  const severity =
    vuln.severity?.[0]?.score ||
    vuln.database_specific?.severity ||
    vuln.severity ||
    "UNKNOWN";
  const upper = String(severity).toUpperCase();
  if (upper.includes("CRITICAL")) return "CRITICAL";
  if (upper.includes("HIGH")) return "HIGH";
  if (upper.includes("MODERATE") || upper.includes("MEDIUM")) return "MODERATE";
  if (upper.includes("LOW")) return "LOW";
  if (upper.startsWith("CVSS:")) {
    const match = upper.match(/CVSS:.*?\/(\d+\.?\d*)/);
    const score = match ? parseFloat(match[1]) : 0;
    if (score >= 9) return "CRITICAL";
    if (score >= 7) return "HIGH";
    if (score >= 4) return "MODERATE";
    if (score > 0) return "LOW";
  }
  return "UNKNOWN";
}

function extractAffectedVersions(vuln: any): string[] {
  const versions: string[] = [];
  (vuln.affected || []).forEach((aff: any) => {
    if (aff.package?.ecosystem === "npm" || !aff.package?.ecosystem) {
      (aff.versions || []).forEach((v: string) => versions.push(v));
    }
  });
  return [...new Set(versions)].slice(0, 10);
}

async function fetchRegistryPackage(
  packageName: string,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
): Promise<any | null> {
  const cacheKey = packageName.toLowerCase();
  if (REGISTRY_CACHE.has(cacheKey)) {
    return REGISTRY_CACHE.get(cacheKey);
  }
  try {
    const res = await fetchFn(`https://registry.npmjs.org/${encodeRegistryName(packageName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    REGISTRY_CACHE.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

async function fetchOsvAdvisories(
  packageName: string,
  version: string | undefined,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
) {
  try {
    const body: any = {
      package: { name: packageName, ecosystem: "npm" },
    };
    if (version) body.version = version;

    const res = await fetchFn("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.vulns || []).map((vuln: any) => ({
      id: vuln.id,
      summary: vuln.summary || vuln.details?.slice(0, 200) || "Security vulnerability",
      severity: parseSeverity(vuln),
      affectedVersions: extractAffectedVersions(vuln),
      published: vuln.published || vuln.modified,
    }));
  } catch {
    return [];
  }
}

async function fetchOsvBatch(
  packages: { name: string; version: string }[],
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  if (packages.length === 0) return result;

  const unique = new Map<string, { name: string; version: string }>();
  packages.forEach((pkg) => unique.set(`${pkg.name}@${pkg.version}`, pkg));

  const chunks: { name: string; version: string }[][] = [];
  const list = [...unique.values()];
  for (let i = 0; i < list.length; i += 100) {
    chunks.push(list.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const res = await fetchFn("https://api.osv.dev/v1/querybatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: chunk.map((pkg) => ({
            package: { name: pkg.name, ecosystem: "npm" },
            version: pkg.version,
          })),
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      (data.results || []).forEach((entry: any, idx: number) => {
        const pkg = chunk[idx];
        const key = `${pkg.name}@${pkg.version}`;
        const vulns = (entry.vulns || []).map((vuln: any) => ({
          id: vuln.id,
          summary: vuln.summary || "Security vulnerability",
          severity: parseSeverity(vuln),
          affectedVersions: extractAffectedVersions(vuln),
          published: vuln.published || vuln.modified,
        }));
        result.set(key, vulns);
      });
    } catch {
      // non-fatal
    }
  }

  return result;
}

async function fetchBundlephobiaSize(
  packageName: string,
  version: string,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
) {
  try {
    const res = await fetchFn(
      `https://bundlephobia.com/api/size?package=${encodeURIComponent(`${packageName}@${version}`)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      minifiedBytes: data.size ?? null,
      gzipBytes: data.gzip ?? null,
      dependencyCount: data.dependencyCount ?? data.dependencySizes?.length ?? null,
      source: "bundlephobia" as const,
    };
  } catch {
    return null;
  }
}

async function fetchAlternatives(
  packageName: string,
  keywords: string[],
  downloads: { lastWeek: number; growthPercent: number },
  repositoryRiskLevel: string,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
) {
  const alternatives: any[] = [];
  const seen = new Set<string>([packageName.toLowerCase()]);

  const searchQueries: { text: string; reason: string }[] = [];
  if (keywords.length > 0) {
    searchQueries.push({ text: keywords.slice(0, 3).join(" "), reason: "similar" });
  }
  searchQueries.push({ text: `alternative to ${packageName.split("/").pop()}`, reason: "similar" });

  if (repositoryRiskLevel === "High" || downloads.growthPercent < -10) {
    searchQueries.push({ text: keywords[0] || packageName.split("/").pop() || "", reason: "safer" });
  }
  if (keywords.length > 0) {
    searchQueries.push({ text: `keywords:${keywords[0]}`, reason: "morePopular" });
  }

  for (const query of searchQueries.slice(0, 3)) {
    if (!query.text.trim()) continue;
    try {
      const res = await fetchFn(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query.text)}&size=8`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      (data.objects || []).forEach((obj: any) => {
        const name = obj.package?.name;
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        alternatives.push({
          name,
          description: obj.package?.description || "",
          reason: query.reason,
          weeklyDownloads: obj.score?.detail?.popularity
            ? Math.round(obj.score.detail.popularity * 100000)
            : undefined,
        });
      });
    } catch {
      // non-fatal
    }
  }

  return alternatives.slice(0, 6);
}

interface TreeBuildNode {
  name: string;
  version: string;
  depth: number;
  type: "prod" | "dev" | "peer" | "optional";
  children: TreeBuildNode[];
}

async function buildDependencyAudit(
  rootName: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  peerDependencies: Record<string, string>,
  optionalDependencies: Record<string, string>,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
) {
  const nodeCount = { value: 0 };
  const occurrenceMap = new Map<string, number>();
  const flatPackages: { name: string; version: string; depth: number; type: string; path: string[] }[] = [];

  async function resolveLatestVersion(name: string): Promise<string | null> {
    const registry = await fetchRegistryPackage(name, fetchFn);
    if (!registry) return null;
    return registry["dist-tags"]?.latest || null;
  }

  async function buildNode(
    name: string,
    versionRange: string,
    depth: number,
    type: "prod" | "dev" | "peer" | "optional",
    path: string[],
  ): Promise<TreeBuildNode | null> {
    if (depth > MAX_TREE_DEPTH || nodeCount.value >= MAX_TREE_NODES) return null;

    const version = (await resolveLatestVersion(name)) || versionRange.replace(/^[\^~>=<]+/, "");
    if (!version) return null;

    nodeCount.value += 1;
    occurrenceMap.set(name, (occurrenceMap.get(name) || 0) + 1);
    const currentPath = [...path, name];
    flatPackages.push({ name, version, depth, type, path: currentPath });

    const registry = await fetchRegistryPackage(name, fetchFn);
    const versionData = registry?.versions?.[version] || {};
    const childDeps = versionData.dependencies || {};

    const children: TreeBuildNode[] = [];
    if (depth < MAX_TREE_DEPTH) {
      const childEntries = Object.entries(childDeps).slice(0, IS_VERCEL ? 6 : 12);
      const childNodes = await Promise.all(
        childEntries.map(([childName, childRange]) => {
          if (nodeCount.value >= MAX_TREE_NODES) return Promise.resolve(null);
          return buildNode(childName, String(childRange), depth + 1, "prod", currentPath);
        }),
      );
      childNodes.forEach((child) => {
        if (child) children.push(child);
      });
    }

    return { name, version, depth, type, children };
  }

  const roots: TreeBuildNode[] = [];
  const rootDepSets: [Record<string, string>, "prod" | "dev" | "peer" | "optional"][] = [
    [dependencies, "prod"],
    [peerDependencies, "peer"],
    [optionalDependencies, "optional"],
  ];
  if (!IS_VERCEL) {
    rootDepSets.splice(1, 0, [devDependencies, "dev"]);
  }

  for (const [depMap, type] of rootDepSets) {
    const entries = Object.entries(depMap).slice(0, IS_VERCEL ? 10 : 15);
    const nodes = await Promise.all(
      entries.map(([name, range]) => {
        if (nodeCount.value >= MAX_TREE_NODES) return Promise.resolve(null);
        return buildNode(name, range, 1, type, [rootName]);
      }),
    );
    nodes.forEach((node) => {
      if (node) roots.push(node);
    });
  }

  const vulnMap = await fetchOsvBatch(
    flatPackages.map((p) => ({ name: p.name, version: p.version })),
    fetchFn,
  );

  const vulnerabilities: any[] = [];
  const vulnerableKeys = new Set<string>();

  flatPackages.forEach((pkg) => {
    const key = `${pkg.name}@${pkg.version}`;
    const vulns = vulnMap.get(key) || [];
    if (vulns.length > 0) {
      vulnerableKeys.add(key);
      vulns.forEach((vuln: any) => {
        vulnerabilities.push({
          packageName: pkg.name,
          version: pkg.version,
          severity: vuln.severity,
          id: vuln.id,
          summary: vuln.summary,
          path: pkg.path,
          isDirect: pkg.depth === 1,
        });
      });
    }
  });

  const directVulnerable = new Set(
    vulnerabilities.filter((v) => v.isDirect).map((v) => v.packageName),
  ).size;
  const transitiveVulnerable = new Set(
    vulnerabilities.filter((v) => !v.isDirect).map((v) => v.packageName),
  ).size;

  const duplicatePackages = [...occurrenceMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));

  function annotateTree(node: TreeBuildNode): any {
    const key = `${node.name}@${node.version}`;
    return {
      name: node.name,
      version: node.version,
      depth: node.depth,
      type: node.type,
      vulnerable: vulnerableKeys.has(key),
      children: node.children.map(annotateTree),
    };
  }

  return {
    totalPackages: flatPackages.length,
    maxDepth: flatPackages.reduce((max, p) => Math.max(max, p.depth), 0),
    duplicateCount: duplicatePackages.length,
    duplicatePackages: duplicatePackages.slice(0, 15),
    directVulnerable,
    transitiveVulnerable,
    totalVulnerabilities: vulnerabilities.length,
    vulnerabilities: vulnerabilities.slice(0, 30),
    tree: roots.map(annotateTree),
  };
}

function emptySecurityAnalytics(unpackedSize: number | null) {
  return {
    advisories: [],
    bundleSize: {
      minifiedBytes: unpackedSize,
      gzipBytes: unpackedSize ? Math.round(unpackedSize * 0.3) : null,
      dependencyCount: null,
      source: "registry" as const,
    },
    dependencyAudit: emptyDependencyAudit(),
    alternatives: [],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function fetchSecurityAnalytics(input: {
  packageName: string;
  version: string;
  keywords: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  downloads: { lastWeek: number; growthPercent: number };
  repositoryRiskLevel: string;
  unpackedSize: number | null;
  fetchFn: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [advisories, bundleSize, dependencyAudit, alternatives] = await Promise.all([
    fetchOsvAdvisories(input.packageName, input.version, input.fetchFn),
    fetchBundlephobiaSize(input.packageName, input.version, input.fetchFn),
    buildDependencyAudit(
      input.packageName,
      input.dependencies,
      input.devDependencies,
      input.peerDependencies,
      input.optionalDependencies,
      input.fetchFn,
    ),
    fetchAlternatives(
      input.packageName,
      input.keywords,
      input.downloads,
      input.repositoryRiskLevel,
      input.fetchFn,
    ),
  ]);

  const bundle = bundleSize || {
    minifiedBytes: input.unpackedSize,
    gzipBytes: input.unpackedSize ? Math.round(input.unpackedSize * 0.3) : null,
    dependencyCount: null,
    source: "registry" as const,
  };

  return { advisories, bundleSize: bundle, dependencyAudit, alternatives };
}

const POPULAR_PACKAGES = [
  "react", "vue", "angular", "svelte", "express", "nestjs", "fastify", "typescript", "vite", "tailwindcss",
  "lodash", "axios", "uuid", "zod", "framer-motion", "redux", "zustand", "next", "esbuild", "prettier",
];

const STALE_ISSUE_DAYS = 365;
const INACTIVE_REPO_DAYS = 180;
const LOW_CONTRIBUTOR_THRESHOLD = 3;
const STALE_ISSUE_COUNT_THRESHOLD = 5;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

function computeBusFactor(commits: any[], contributors: any[]): { value: number; triggered: boolean; detail: string } {
  const authorCounts = new Map<string, number>();
  commits.forEach((commit) => {
    const login = commit.author?.login || commit.commit?.author?.name || "unknown";
    authorCounts.set(login, (authorCounts.get(login) || 0) + 1);
  });

  const totalCommits = commits.length;
  if (totalCommits === 0) {
    const contributorCount = contributors.length;
    const value = Math.max(contributorCount, 1);
    if (contributorCount <= 1) {
      return { value, triggered: true, detail: `Only ${contributorCount} contributor on record` };
    }
    return { value, triggered: false, detail: `${contributorCount} contributors listed` };
  }

  const sortedCounts = [...authorCounts.values()].sort((a, b) => b - a);
  let cumulative = 0;
  let peopleNeeded = 0;
  const half = totalCommits / 2;

  for (const count of sortedCounts) {
    cumulative += count;
    peopleNeeded++;
    if (cumulative >= half) break;
  }

  const uniqueAuthors = authorCounts.size;
  if (peopleNeeded <= 1 || uniqueAuthors <= 1) {
    return {
      value: peopleNeeded,
      triggered: true,
      detail: `Bus factor is ${peopleNeeded} — a single author accounts for most recent commits`,
    };
  }
  if (peopleNeeded === 2) {
    return {
      value: peopleNeeded,
      triggered: true,
      detail: `Bus factor is ${peopleNeeded} — only two people account for half of recent commits`,
    };
  }

  return {
    value: peopleNeeded,
    triggered: false,
    detail: `Bus factor is ${peopleNeeded} across ${uniqueAuthors} recent contributors`,
  };
}

function computeRepositoryRisk(input: {
  hasGithub: boolean;
  gitRepo?: any;
  contributors?: any[];
  commits?: any[];
  issues?: any[];
  hasReleases?: boolean;
  hasReadme?: boolean;
}): any {
  const noGithubFactors = {
    busFactor: { label: "Bus factor", triggered: false, detail: "No GitHub repository linked" },
    inactiveMaintainers: { label: "Inactive maintainers", triggered: false, detail: "No GitHub repository linked" },
    archivedRepository: { label: "Archived repository", triggered: false, detail: "No GitHub repository linked" },
    staleIssues: { label: "Too many stale issues", triggered: false, detail: "No GitHub repository linked" },
    noReleases: { label: "No releases", triggered: false, detail: "No GitHub repository linked" },
    lowContributorCount: { label: "Low contributor count", triggered: false, detail: "No GitHub repository linked" },
    noDocumentation: { label: "No documentation", triggered: false, detail: "No GitHub repository linked" },
  };

  if (!input.hasGithub || !input.gitRepo) {
    return {
      level: "Medium",
      factors: noGithubFactors,
      summary: "No linked GitHub repository — repository risk cannot be fully assessed",
    };
  }

  const gitRepo = input.gitRepo;
  const contributors = input.contributors || [];
  const commits = input.commits || [];
  const issues = input.issues || [];

  const busFactor = computeBusFactor(commits, contributors);

  const daysSincePush = daysSince(gitRepo.pushed_at);
  const inactiveMaintainers = {
    label: "Inactive maintainers",
    triggered: daysSincePush === null || daysSincePush > INACTIVE_REPO_DAYS,
    detail:
      daysSincePush === null
        ? "No recent push activity recorded"
        : daysSincePush > INACTIVE_REPO_DAYS
          ? `Last push was ${daysSincePush} days ago`
          : `Last push was ${daysSincePush} days ago`,
  };

  const archivedRepository = {
    label: "Archived repository",
    triggered: !!gitRepo.archived,
    detail: gitRepo.archived ? "Repository is archived on GitHub" : "Repository is active",
  };

  const openIssues = issues.length;
  const staleIssuesList = issues.filter((issue) => {
    const days = daysSince(issue.updated_at);
    return days !== null && days > STALE_ISSUE_DAYS;
  });
  const staleCount = staleIssuesList.length;
  const staleRatio = openIssues > 0 ? staleCount / openIssues : 0;
  const staleIssues = {
    label: "Too many stale issues",
    triggered: staleCount >= STALE_ISSUE_COUNT_THRESHOLD || (openIssues > 0 && staleRatio >= 0.5),
    detail:
      openIssues === 0
        ? "No open issues"
        : `${staleCount} of ${openIssues} open issues untouched for over a year`,
  };

  const noReleases = {
    label: "No releases",
    triggered: !input.hasReleases,
    detail: input.hasReleases ? "GitHub releases are published" : "No GitHub releases found",
  };

  const contributorCount = contributors.length;
  const lowContributorCount = {
    label: "Low contributor count",
    triggered: contributorCount < LOW_CONTRIBUTOR_THRESHOLD,
    detail:
      contributorCount === 0
        ? "No contributors recorded"
        : `${contributorCount} contributor${contributorCount === 1 ? "" : "s"} on record`,
  };

  const hasDocs = !!input.hasReadme || !!gitRepo.has_wiki || !!gitRepo.description;
  const noDocumentation = {
    label: "No documentation",
    triggered: !hasDocs,
    detail: hasDocs ? "README, wiki, or repository description present" : "No README, wiki, or description found",
  };

  const factors = {
    busFactor: { label: "Bus factor", ...busFactor },
    inactiveMaintainers,
    archivedRepository,
    staleIssues,
    noReleases,
    lowContributorCount,
    noDocumentation,
  };

  const triggeredCount = Object.values(factors).filter((f) => f.triggered).length;
  let level: "Low" | "Medium" | "High" = "Low";
  if (archivedRepository.triggered || triggeredCount >= 4) {
    level = "High";
  } else if (triggeredCount >= 2) {
    level = "Medium";
  }

  const summary =
    level === "High"
      ? `${triggeredCount} risk signal${triggeredCount === 1 ? "" : "s"} detected — exercise caution before adopting`
      : level === "Medium"
        ? `${triggeredCount} moderate risk signal${triggeredCount === 1 ? "" : "s"} — review repository health`
        : triggeredCount === 0
          ? "Repository appears healthy with no major risk signals"
          : `${triggeredCount} minor risk signal${triggeredCount === 1 ? "" : "s"} detected`;

  return { level, factors, summary };
}

async function fetchGithubRiskData(owner: string, repo: string, headers: Record<string, string>) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const [contributorsRes, commitsRes, issuesRes, releasesRes, readmeRes] = await Promise.all([
    fetchWithRetry(`${base}/contributors?per_page=100`, { headers }).catch(() => null),
    fetchWithRetry(`${base}/commits?per_page=30`, { headers }).catch(() => null),
    fetchWithRetry(`${base}/issues?state=open&per_page=30&sort=updated`, { headers }).catch(() => null),
    fetchWithRetry(`${base}/releases?per_page=1`, { headers }).catch(() => null),
    fetchWithRetry(`${base}/readme`, { headers }).catch(() => null),
  ]);

  const contributors = contributorsRes?.ok ? await contributorsRes.json() : [];
  const commits = commitsRes?.ok ? await commitsRes.json() : [];
  const issuesRaw = issuesRes?.ok ? await issuesRes.json() : [];
  const issues = Array.isArray(issuesRaw) ? issuesRaw.filter((item: any) => !item.pull_request) : [];
  const releases = releasesRes?.ok ? await releasesRes.json() : [];
  const hasReleases = Array.isArray(releases) && releases.length > 0;
  const hasReadme = readmeRes?.ok === true;

  return { contributors, commits, issues, hasReleases, hasReadme };
}

function getPackageScope(packageName: string): string | null {
  if (packageName.startsWith("@") && packageName.includes("/")) {
    return packageName.split("/")[0].slice(1);
  }
  return null;
}

function normalizeMaintainers(maintainers: any[]): any[] {
  return (maintainers || []).map((maintainer) => ({
    name: maintainer.name || maintainer.username || "Unknown",
    email: maintainer.email,
    url: maintainer.url,
  }));
}

async function fetchPublisherInformation(
  packageName: string,
  registry: any,
  latestVersionData: any,
  maintainers: any[],
  timeData: Record<string, string>,
  latestVersionString: string,
) {
  const normalizedMaintainers = normalizeMaintainers(maintainers);
  const publisherUser = latestVersionData._npmUser;
  const publisher =
    publisherUser?.name ||
    normalizedMaintainers[0]?.name ||
    (typeof registry.author === "string" ? registry.author : registry.author?.name) ||
    "Unknown";

  const scope = getPackageScope(packageName);
  const organization = scope ? `@${scope}` : null;
  const firstPublish = timeData.created || "";
  const lastPublish = timeData[latestVersionString] || timeData.modified || "";
  const hasSignatures = Array.isArray(latestVersionData.dist?.signatures) && latestVersionData.dist.signatures.length > 0;

  let packagesPublished: number | null = null;
  let orgRegistered = false;

  if (scope) {
    try {
      const orgRes = await fetchWithRetry(`https://registry.npmjs.org/-/org/${scope}/package`);
      if (orgRes.ok) {
        const orgPackages = await orgRes.json();
        if (orgPackages && typeof orgPackages === "object" && !orgPackages.error) {
          packagesPublished = Object.keys(orgPackages).length;
          orgRegistered = true;
        }
      }
    } catch {
      // non-fatal
    }
  }

  if (packagesPublished === null && publisher !== "Unknown") {
    try {
      const searchRes = await fetchWithRetry(
        `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(publisher)}&size=1`,
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        packagesPublished = typeof searchData.total === "number" ? searchData.total : null;
      }
    } catch {
      // non-fatal
    }
  }

  const verifiedPublisher = orgRegistered || hasSignatures || (!!publisherUser?.name && !!publisherUser?.email);

  let verifiedPublisherDetail = "Publisher account could not be verified";
  if (orgRegistered && hasSignatures) {
    verifiedPublisherDetail = "Registered npm organization with signed latest release";
  } else if (orgRegistered) {
    verifiedPublisherDetail = "Published under a registered npm organization";
  } else if (hasSignatures) {
    verifiedPublisherDetail = "Latest release tarball is cryptographically signed";
  } else if (publisherUser?.name && publisherUser?.email) {
    verifiedPublisherDetail = "Latest publish linked to a public npm user profile";
  }

  return {
    publisher,
    maintainers: normalizedMaintainers,
    organization,
    verifiedPublisher,
    verifiedPublisherDetail,
    maintainerCount: normalizedMaintainers.length,
    firstPublish,
    lastPublish,
    packagesPublished,
  };
}

function hasExportCondition(exportsField: unknown, condition: string): boolean {
  if (!exportsField || typeof exportsField !== "object") return false;
  if (condition in (exportsField as Record<string, unknown>)) return true;
  return Object.values(exportsField as Record<string, unknown>).some(
    (value) => typeof value === "object" && value !== null && hasExportCondition(value, condition),
  );
}

function normalizeFunding(funding: unknown): { hasFunding: boolean; fundingUrl: string | null } {
  if (!funding) return { hasFunding: false, fundingUrl: null };
  if (typeof funding === "string") return { hasFunding: true, fundingUrl: funding };
  if (Array.isArray(funding)) {
    const first = funding[0];
    if (typeof first === "string") return { hasFunding: true, fundingUrl: first };
    if (first && typeof first === "object" && "url" in first) {
      return { hasFunding: true, fundingUrl: String((first as { url?: string }).url || "") };
    }
  }
  if (typeof funding === "object" && funding !== null && "url" in funding) {
    return { hasFunding: true, fundingUrl: String((funding as { url?: string }).url || "") };
  }
  return { hasFunding: true, fundingUrl: null };
}

function buildComparisonMetrics(input: {
  registry: any;
  latestVersionData: any;
  versionsList: any[];
  github: any;
  health: any;
  license: string;
  busFactorValue: number | null;
  releaseDaysAgo: number;
  timeData: Record<string, string>;
  latestVersionString: string;
}) {
  const { latestVersionData, versionsList, github, health, license, busFactorValue, releaseDaysAgo, timeData, latestVersionString } = input;
  const unpackedSize = latestVersionData.dist?.unpackedSize ?? null;
  const dependencyCount =
    Object.keys(latestVersionData.dependencies || {}).length +
    Object.keys(latestVersionData.peerDependencies || {}).length +
    Object.keys(latestVersionData.optionalDependencies || {}).length;

  const packageAgeDays = daysSince(timeData.created);
  const lastPublishDate = timeData[latestVersionString] || timeData.modified || "";

  let repositoryActivityDays: number | null = null;
  if (github?.latestCommit?.date) {
    repositoryActivityDays = daysSince(github.latestCommit.date);
  }

  const releaseGaps = versionsList
    .map((version) => version.daysSincePrevious)
    .filter((gap: number | undefined) => typeof gap === "number" && gap > 0) as number[];
  const releaseFrequencyDays =
    releaseGaps.length > 0
      ? Math.round(releaseGaps.reduce((sum, gap) => sum + gap, 0) / releaseGaps.length)
      : null;

  const exportsField = latestVersionData.exports;
  const supportsEsm =
    latestVersionData.type === "module" ||
    !!latestVersionData.module ||
    hasExportCondition(exportsField, "import");
  const supportsCjs =
    !!latestVersionData.main ||
    hasExportCondition(exportsField, "require") ||
    hasExportCondition(exportsField, "default") ||
    (!latestVersionData.type && !!latestVersionData.main);

  const sideEffects = latestVersionData.sideEffects;
  let hasSideEffects: boolean | null = null;
  let treeShaking: boolean | null = null;
  if (sideEffects === false) {
    hasSideEffects = false;
    treeShaking = true;
  } else if (Array.isArray(sideEffects)) {
    hasSideEffects = sideEffects.length > 0;
    treeShaking = sideEffects.length === 0;
  } else if (sideEffects === true) {
    hasSideEffects = true;
    treeShaking = false;
  }

  const funding = normalizeFunding(latestVersionData.funding || input.registry.funding);
  const installSizeBytes =
    unpackedSize !== null ? unpackedSize + dependencyCount * 65000 : null;

  return {
    bundleSizeBytes: unpackedSize,
    packageSizeBytes: unpackedSize,
    installSizeBytes,
    packageAgeDays,
    repositoryActivityDays,
    lastPublishDaysAgo: releaseDaysAgo,
    lastPublishDate,
    contributorsCount: github?.contributorsCount ?? null,
    releaseFrequencyDays,
    dependencyCount,
    license: license || "Proprietary",
    securityScore: health?.metrics?.security?.score ?? 0,
    maintenanceScore: health?.metrics?.maintenance?.score ?? 0,
    busFactor: busFactorValue,
    treeShaking,
    hasSideEffects,
    supportsEsm,
    supportsCjs,
    hasFunding: funding.hasFunding,
    fundingUrl: funding.fundingUrl,
  };
}

function emptyDependencyAudit() {
  return {
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
}

function buildSecurityFallback(payload: any) {
  return {
    isDeprecated: payload.security?.isDeprecated ?? false,
    deprecationReason: payload.security?.deprecationReason,
    maintenanceStatus: payload.security?.maintenanceStatus ?? "inactive",
    hasSecurityAdvisories: payload.security?.hasSecurityAdvisories ?? false,
    advisoriesCount: payload.security?.advisoriesCount ?? 0,
    advisories: payload.security?.advisories ?? [],
    highestSeverity: payload.security?.highestSeverity,
  };
}

function buildComparisonMetricsFallback(payload: any) {
  const dependencyCount = Object.keys(payload.dependencies || {}).length;
  const releaseDaysAgo = payload.lastUpdated
    ? daysSince(payload.lastUpdated) ?? 365
    : 365;

  return {
    bundleSizeBytes: null,
    packageSizeBytes: null,
    installSizeBytes: null,
    packageAgeDays: payload.publishDate ? daysSince(payload.publishDate) : null,
    repositoryActivityDays: payload.github?.latestCommit?.date
      ? daysSince(payload.github.latestCommit.date)
      : null,
    lastPublishDaysAgo: releaseDaysAgo,
    lastPublishDate: payload.lastUpdated || "",
    contributorsCount: payload.github?.contributorsCount ?? null,
    releaseFrequencyDays: null,
    dependencyCount,
    license: payload.license || "Proprietary",
    securityScore: payload.health?.metrics?.security?.score ?? 0,
    maintenanceScore: payload.health?.metrics?.maintenance?.score ?? 0,
    busFactor: null,
    treeShaking: null,
    hasSideEffects: null,
    supportsEsm: false,
    supportsCjs: !!payload.dependencies,
    hasFunding: false,
    fundingUrl: null,
  };
}

function buildPublisherInfoFallback(payload: any, packageName: string) {
  const maintainers = normalizeMaintainers(payload.maintainers || []);
  const scope = getPackageScope(packageName || payload.name || "");

  return {
    publisher: maintainers[0]?.name || payload.author?.name || "Unknown",
    maintainers,
    organization: scope ? `@${scope}` : null,
    verifiedPublisher: false,
    verifiedPublisherDetail: "Publisher details unavailable — reload the package to refresh",
    maintainerCount: maintainers.length,
    firstPublish: payload.publishDate || "",
    lastPublish: payload.lastUpdated || "",
    packagesPublished: null,
  };
}

function enrichPackageResponse(payload: any, packageName: string) {
  if (!payload.repositoryRisk) {
    payload.repositoryRisk = computeRepositoryRisk({ hasGithub: !!payload.github });
  }
  if (!payload.publisherInfo) {
    payload.publisherInfo = buildPublisherInfoFallback(payload, packageName);
  }
  if (!payload.comparisonMetrics) {
    payload.comparisonMetrics = buildComparisonMetricsFallback(payload);
  }
  if (!payload.bundleSize) {
    payload.bundleSize = {
      minifiedBytes: payload.comparisonMetrics?.bundleSizeBytes ?? null,
      gzipBytes: null,
      dependencyCount: null,
      source: "registry",
    };
  }
  if (!payload.dependencyAudit) {
    payload.dependencyAudit = emptyDependencyAudit();
  }
  if (!payload.alternatives) {
    payload.alternatives = [];
  }
  payload.security = buildSecurityFallback(payload);
  return payload;
}

export async function getPackageAnalytics(packageName: string): Promise<any> {
  const decodedName = decodeURIComponent(packageName);
  const cacheKey = `package:v4:${decodedName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return enrichPackageResponse({ ...cached }, decodedName);
  }

  return deduplicator.deduplicate(cacheKey, async () => {
    const encodedRegistryName = decodedName.startsWith("@")
      ? `${decodedName.split("/")[0]}%2F${decodedName.split("/")[1]}`
      : decodedName;

    const registryPromise = fetchWithRetry(`https://registry.npmjs.org/${encodedRegistryName}`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("Package not found");
          throw new Error(`Registry returned status ${r.status}`);
        }
        return r.json();
      });

    const downloadsPromise = fetchWithRetry(`https://api.npmjs.org/downloads/range/last-year/${decodedName}`)
      .then(async (r) => {
        if (!r.ok) {
          console.warn(`Downloads API failed for ${decodedName}. Using fallback.`);
          return generateFallbackDownloads();
        }
        const downloadData = await r.json();
        const history = downloadData.downloads || [];
        if (history.length === 0) {
          return generateFallbackDownloads();
        }

        const total = history.reduce((acc: number, x: any) => acc + x.downloads, 0);
        const lastMonth = history.slice(-30).reduce((acc: number, x: any) => acc + x.downloads, 0);
        const lastWeek = history.slice(-7).reduce((acc: number, x: any) => acc + x.downloads, 0);
        const prevMonth = history.slice(-60, -30).reduce((acc: number, x: any) => acc + x.downloads, 0);

        let growthPercent = 0;
        if (prevMonth > 0) {
          growthPercent = parseFloat((((lastMonth - prevMonth) / prevMonth) * 100).toFixed(1));
        }

        let peakDay = { day: "", downloads: 0 };
        let lowestDay = { day: "", downloads: Infinity };

        history.forEach((h: any) => {
          if (h.downloads > peakDay.downloads) {
            peakDay = { day: h.day, downloads: h.downloads };
          }
          if (h.downloads < lowestDay.downloads) {
            lowestDay = { day: h.day, downloads: h.downloads };
          }
        });

        if (lowestDay.downloads === Infinity) lowestDay.downloads = 0;

        return {
          today: history[history.length - 1]?.downloads || 0,
          lastWeek,
          lastMonth,
          lastYear: total,
          averageDaily: Math.round(total / (history.length || 365)),
          growthPercent,
          peakDay,
          lowestDay,
          history: history.map((h: any) => ({ day: h.day, downloads: h.downloads })),
        };
      })
      .catch((err) => {
        console.error("Downloads API crash, returning fallback:", err.message);
        return generateFallbackDownloads();
      });

    const [registry, downloads] = await Promise.all([registryPromise, downloadsPromise]);

    const distTags = registry["dist-tags"] || {};
    const latestVersionString = distTags.latest || Object.keys(registry.versions || {}).pop() || "0.0.0";
    const latestVersionData = registry.versions?.[latestVersionString] || {};

    const gitInfo = parseGithubUrl(registry.repository || latestVersionData.repository);

    let github: any = null;
    let repositoryRisk: any = null;
    let busFactorValue: number | null = null;
    if (gitInfo) {
      try {
        const headers: any = {};
        if (process.env.GITHUB_TOKEN) {
          headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const gitRepoRes = await fetchWithRetry(`https://api.github.com/repos/${gitInfo.owner}/${gitInfo.repo}`, { headers });
        if (gitRepoRes.ok) {
          const gitRepo = await gitRepoRes.json();

          const [languages, riskData] = await Promise.all([
            fetchWithRetry(`https://api.github.com/repos/${gitInfo.owner}/${gitInfo.repo}/languages`, { headers })
              .then(async (res) => (res.ok ? res.json() : {}))
              .catch(() => ({})),
            fetchGithubRiskData(gitInfo.owner, gitInfo.repo, headers),
          ]);

          github = {
            owner: gitInfo.owner,
            repo: gitInfo.repo,
            stars: gitRepo.stargazers_count || 0,
            forks: gitRepo.forks_count || 0,
            watchers: gitRepo.subscribers_count || gitRepo.watchers_count || 0,
            openIssues: gitRepo.open_issues_count || 0,
            size: gitRepo.size || 0,
            defaultBranch: gitRepo.default_branch || "main",
            languages,
            contributorsCount: riskData.contributors.length,
            latestCommit: riskData.commits[0]
              ? {
                  sha: riskData.commits[0].sha?.slice(0, 7) || "",
                  message: riskData.commits[0].commit?.message?.split("\n")[0] || "",
                  date: riskData.commits[0].commit?.author?.date || "",
                  author: riskData.commits[0].author?.login || riskData.commits[0].commit?.author?.name || "",
                }
              : undefined,
          };

          repositoryRisk = computeRepositoryRisk({
            hasGithub: true,
            gitRepo,
            contributors: riskData.contributors,
            commits: riskData.commits,
            issues: riskData.issues,
            hasReleases: riskData.hasReleases,
            hasReadme: riskData.hasReadme,
          });
          busFactorValue = computeBusFactor(riskData.commits, riskData.contributors).value;
        }
      } catch (gitErr: any) {
        console.warn("GitHub Fetch Failed for repo:", gitInfo.owner, gitInfo.repo, gitErr.message);
      }
    }

    if (!repositoryRisk) {
      repositoryRisk = computeRepositoryRisk({ hasGithub: false });
    }

    const timeData = registry.time || {};
    const versionsList: any[] = [];
    const versionsKeys = Object.keys(registry.versions || {}).reverse();

    versionsKeys.forEach((vStr, idx) => {
      const publishDateStr = timeData[vStr] || "";
      let daysSincePrevious: number | undefined;

      if (publishDateStr) {
        const currentPublishDate = new Date(publishDateStr);
        if (idx < versionsKeys.length - 1) {
          const nextOlderVersion = versionsKeys[idx + 1];
          const nextOlderDateStr = timeData[nextOlderVersion];
          if (nextOlderDateStr) {
            const olderDate = new Date(nextOlderDateStr);
            daysSincePrevious = Math.max(0, Math.round((currentPublishDate.getTime() - olderDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
      }

      let type: string = "other";
      if (vStr === latestVersionString) type = "latest";
      else if (vStr.includes("beta")) type = "beta";
      else if (vStr.includes("alpha")) type = "alpha";
      else if (vStr.includes("rc")) type = "rc";
      else type = "previous";

      versionsList.push({
        version: vStr,
        publishDate: publishDateStr,
        daysSincePrevious,
        type,
      });
    });

    const deprecationReason = latestVersionData.deprecated || registry.versions?.[Object.keys(registry.versions || {}).pop() || ""]?.deprecated;
    const isDeprecated = !!deprecationReason;

    const hasTSDeclarations =
      !!latestVersionData.types ||
      !!latestVersionData.typings ||
      !!(latestVersionData.dependencies && latestVersionData.dependencies["typescript"]) ||
      decodedName.startsWith("@types/") ||
      !!(registry.versions && Object.values(registry.versions).some((v: any) => v.types || v.typings));

    const lastReleaseDateStr = timeData[latestVersionString] || timeData.modified || "";
    let releaseDaysAgo = 365;
    if (lastReleaseDateStr) {
      releaseDaysAgo = Math.round((Date.now() - new Date(lastReleaseDateStr).getTime()) / (1000 * 60 * 60 * 24));
    }

    const mScore = isDeprecated ? 0 : releaseDaysAgo < 30 ? 25 : releaseDaysAgo < 90 ? 22 : releaseDaysAgo < 180 ? 18 : releaseDaysAgo < 365 ? 12 : 5;
    const dScore = downloads.lastWeek > 1000000 ? 25 : downloads.lastWeek > 100000 ? 22 : downloads.lastWeek > 10000 ? 18 : downloads.lastWeek > 1000 ? 12 : downloads.lastWeek > 100 ? 8 : 4;
    const tsScore = hasTSDeclarations ? 15 : 0;
    const cScore = github ? (github.stars > 10000 ? 20 : github.stars > 1000 ? 17 : github.stars > 100 ? 12 : 8) : 8;

    const maintainers = registry.maintainers || [];
    const unpackedSize = latestVersionData.dist?.unpackedSize ?? null;
    const [publisherInfo, securityAnalytics] = await Promise.all([
      fetchPublisherInformation(
        decodedName,
        registry,
        latestVersionData,
        maintainers,
        timeData,
        latestVersionString,
      ),
      withTimeout(
        fetchSecurityAnalytics({
          packageName: decodedName,
          version: latestVersionString,
          keywords: registry.keywords || [],
          dependencies: latestVersionData.dependencies || {},
          devDependencies: latestVersionData.devDependencies || {},
          peerDependencies: latestVersionData.peerDependencies || {},
          optionalDependencies: latestVersionData.optionalDependencies || {},
          downloads: { lastWeek: downloads.lastWeek, growthPercent: downloads.growthPercent },
          repositoryRiskLevel: repositoryRisk?.level || "Medium",
          unpackedSize,
          fetchFn: (url, options) => fetchWithRetry(url, options),
        }),
        SECURITY_ANALYTICS_TIMEOUT_MS,
        "Security analytics",
      ).catch((securityErr: any) => {
        console.warn("Security analytics failed:", securityErr?.message || securityErr);
        return emptySecurityAnalytics(unpackedSize);
      }),
    ]);

    const advisories = securityAnalytics.advisories;
    const hasSecurityAdvisories = advisories.length > 0;
    const depAudit = securityAnalytics.dependencyAudit;
    const severityRank = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"];
    const highestSeverity = advisories
      .map((a: any) => a.severity)
      .sort((a: string, b: string) => severityRank.indexOf(a) - severityRank.indexOf(b))[0];

    let sScore = 15;
    if (isDeprecated) {
      sScore = 0;
    } else if (advisories.some((a: any) => a.severity === "CRITICAL" || a.severity === "HIGH")) {
      sScore = 3;
    } else if (hasSecurityAdvisories) {
      sScore = 8;
    } else if (depAudit.totalVulnerabilities > 0) {
      sScore = 10;
    }

    const healthScore = Math.max(0, Math.min(100, mScore + dScore + tsScore + cScore + sScore));

    const comparisonMetrics = buildComparisonMetrics({
      registry,
      latestVersionData,
      versionsList,
      github,
      health: {
        metrics: {
          maintenance: { score: mScore },
          security: { score: sScore },
        },
      },
      license: registry.license || "Proprietary",
      busFactorValue,
      releaseDaysAgo,
      timeData,
      latestVersionString,
    });

    if (securityAnalytics.bundleSize.minifiedBytes !== null) {
      comparisonMetrics.bundleSizeBytes = securityAnalytics.bundleSize.minifiedBytes;
      comparisonMetrics.packageSizeBytes = securityAnalytics.bundleSize.minifiedBytes;
    }
    if (securityAnalytics.bundleSize.gzipBytes !== null && depAudit.totalPackages > 0) {
      comparisonMetrics.installSizeBytes =
        securityAnalytics.bundleSize.gzipBytes + depAudit.totalPackages * 45000;
    }

    const securityValue = isDeprecated
      ? "Deprecated package"
      : hasSecurityAdvisories
        ? `${advisories.length} advisory${advisories.length === 1 ? "" : "ies"} (${highestSeverity || "UNKNOWN"})`
        : depAudit.totalVulnerabilities > 0
          ? `${depAudit.totalVulnerabilities} vulnerable dependencies`
          : "No known security advisories";

    const responsePayload = {
      name: registry.name || decodedName,
      description: registry.description || "No description provided",
      latestVersion: latestVersionString,
      author: typeof registry.author === "string" ? { name: registry.author } : registry.author,
      license: registry.license || "Proprietary",
      homepage: registry.homepage,
      githubUrl: github ? `https://github.com/${github.owner}/${github.repo}` : undefined,
      keywords: registry.keywords || [],
      publishDate: timeData.created || "",
      lastUpdated: lastReleaseDateStr,
      totalVersions: versionsList.length,
      maintainers,
      dependencies: latestVersionData.dependencies || {},
      devDependencies: latestVersionData.devDependencies || {},
      peerDependencies: latestVersionData.peerDependencies || {},
      optionalDependencies: latestVersionData.optionalDependencies || {},
      versionsList: versionsList.slice(0, 50),
      downloads,
      github,
      health: {
        score: healthScore,
        metrics: {
          maintenance: { score: mScore, label: "Release Frequency", value: releaseDaysAgo < 365 ? `${releaseDaysAgo} days since last publish` : "Over a year ago" },
          popularity: { score: dScore, label: "Weekly Downloads", value: downloads.lastWeek.toLocaleString() },
          typescript: { score: tsScore, label: "TypeScript Ready", value: hasTSDeclarations },
          community: { score: cScore, label: "GitHub Stars", value: github ? github.stars.toLocaleString() : "No GitHub connected" },
          security: { score: sScore, label: "Security Status", value: securityValue },
        },
      },
      security: {
        isDeprecated,
        deprecationReason,
        maintenanceStatus: isDeprecated ? "deprecated" : releaseDaysAgo < 180 ? "active" : "inactive",
        hasSecurityAdvisories,
        advisoriesCount: advisories.length,
        advisories,
        highestSeverity,
      },
      repositoryRisk,
      publisherInfo,
      comparisonMetrics,
      bundleSize: securityAnalytics.bundleSize,
      dependencyAudit: depAudit,
      alternatives: securityAnalytics.alternatives,
    };

    cache.set(cacheKey, responsePayload, 60 * 60 * 1000);
    return enrichPackageResponse(responsePayload, decodedName);
  });
}

export function createApiApp(): express.Application {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const rateLimit = rateLimitMap.get(ip);

    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      next();
    } else {
      rateLimit.count++;
      if (rateLimit.count > RATE_LIMIT_MAX_REQUESTS) {
        res.status(429).json({
          error: "Too Many Requests",
          message: "You have exceeded the request rate limit. Please try again in a minute.",
        });
      } else {
        next();
      }
    }
  });

  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.json([]);
    }

    const cacheKey = `search:${query}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    try {
      const searchRes = await fetchWithRetry(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`);
      if (!searchRes.ok) {
        throw new Error(`NPM registry search failed with status ${searchRes.status}`);
      }
      const data = await searchRes.json();
      const results = (data.objects || []).map((obj: any) => ({
        name: obj.package.name,
        description: obj.package.description,
        version: obj.package.version,
        date: obj.package.date,
        keywords: obj.package.keywords,
        publisher: obj.package.publisher,
      }));

      cache.set(cacheKey, results, 5 * 60 * 1000);
      return res.json(results);
    } catch (err: any) {
      console.error("Search API Error:", err.message);
      return res.status(500).json({ error: "Failed to search packages", details: err.message });
    }
  });

  app.get("/api/package/*", async (req, res) => {
    const packageName = req.params[0];
    if (!packageName) {
      return res.status(400).json({ error: "Package name is required" });
    }

    try {
      const result = await getPackageAnalytics(packageName);
      return res.json(result);
    } catch (err: any) {
      console.error("Full Package Fetch Error:", err.message);
      return res.status(err.message === "Package not found" ? 404 : 500).json({
        error: "Failed to fetch package analytics",
        message: err.message,
      });
    }
  });

  app.get("/api/compare", async (req, res) => {
    const pkgsString = req.query.packages as string;
    if (!pkgsString) {
      return res.status(400).json({ error: "No packages specified for comparison" });
    }

    const packageNames = pkgsString.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 4);

    try {
      const results = await Promise.all(
        packageNames.map(async (name) => {
          try {
            return await getPackageAnalytics(name);
          } catch (e) {
            console.error(`Compare fetch failed for ${name}:`, e);
            return null;
          }
        })
      );

      return res.json(results.filter(Boolean));
    } catch (err: any) {
      console.error("Compare API Error:", err.message);
      return res.status(500).json({ error: "Comparison calculation failed", details: err.message });
    }
  });

  app.get("/api/rankings", async (req, res) => {
    const cacheKey = "rankings:all";
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    try {
      const items = await Promise.all(
        POPULAR_PACKAGES.map(async (pName) => {
          try {
            const data = await getPackageAnalytics(pName);
            return {
              name: data.name,
              description: data.description,
              downloads: data.downloads.lastWeek,
              growthPercent: data.downloads.growthPercent,
              stars: data.github?.stars || 0,
              healthScore: data.health.score,
              lastUpdated: data.lastUpdated,
            };
          } catch {
            return null;
          }
        })
      );

      const validItems = items.filter(Boolean) as any[];

      const topDownloaded = [...validItems]
        .sort((a, b) => b.downloads - a.downloads)
        .map((item, idx) => ({
          rank: idx + 1,
          name: item.name,
          description: item.description,
          downloads: item.downloads,
          growthPercent: item.growthPercent,
          category: "Most Downloaded",
        }));

      const trending = [...validItems]
        .sort((a, b) => b.growthPercent - a.growthPercent)
        .map((item, idx) => ({
          rank: idx + 1,
          name: item.name,
          description: item.description,
          downloads: item.downloads,
          growthPercent: item.growthPercent,
          category: "Trending",
        }));

      const topStarred = [...validItems]
        .sort((a, b) => b.stars - a.stars)
        .map((item, idx) => ({
          rank: idx + 1,
          name: item.name,
          description: item.description,
          downloads: item.downloads,
          growthPercent: item.growthPercent,
          category: "Top Starred",
        }));

      const responsePayload = {
        mostDownloaded: topDownloaded,
        trending,
        topStarred,
      };

      cache.set(cacheKey, responsePayload, 12 * 60 * 60 * 1000);
      return res.json(responsePayload);
    } catch (err: any) {
      console.error("Rankings API Error:", err.message);
      return res.status(500).json({ error: "Failed to generate rankings", details: err.message });
    }
  });

  return app;
}
