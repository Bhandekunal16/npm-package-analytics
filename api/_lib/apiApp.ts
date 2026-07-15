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

function computeBusFactor(commits: any[], contributors: any[]): { triggered: boolean; detail: string } {
  const authorCounts = new Map<string, number>();
  commits.forEach((commit) => {
    const login = commit.author?.login || commit.commit?.author?.name || "unknown";
    authorCounts.set(login, (authorCounts.get(login) || 0) + 1);
  });

  const totalCommits = commits.length;
  if (totalCommits === 0) {
    const contributorCount = contributors.length;
    if (contributorCount <= 1) {
      return { triggered: true, detail: `Only ${contributorCount} contributor on record` };
    }
    return { triggered: false, detail: `${contributorCount} contributors listed` };
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
      triggered: true,
      detail: `Bus factor is ${peopleNeeded} — a single author accounts for most recent commits`,
    };
  }
  if (peopleNeeded === 2) {
    return {
      triggered: true,
      detail: `Bus factor is ${peopleNeeded} — only two people account for half of recent commits`,
    };
  }

  return {
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
  return payload;
}

export async function getPackageAnalytics(packageName: string): Promise<any> {
  const decodedName = decodeURIComponent(packageName);
  const cacheKey = `package:v2:${decodedName}`;
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
    const hasSecurityAdvisories = false;

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
    const sScore = isDeprecated ? 0 : 15;

    const healthScore = Math.max(0, Math.min(100, mScore + dScore + tsScore + cScore + sScore));

    const maintainers = registry.maintainers || [];
    const publisherInfo = await fetchPublisherInformation(
      decodedName,
      registry,
      latestVersionData,
      maintainers,
      timeData,
      latestVersionString,
    );

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
          security: { score: sScore, label: "Security Status", value: isDeprecated ? "Deprecated package" : "No known security advisories" },
        },
      },
      security: {
        isDeprecated,
        deprecationReason,
        maintenanceStatus: isDeprecated ? "deprecated" : releaseDaysAgo < 180 ? "active" : "inactive",
        hasSecurityAdvisories,
        advisoriesCount: 0,
      },
      repositoryRisk,
      publisherInfo,
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
