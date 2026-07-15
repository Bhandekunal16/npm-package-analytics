/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const MAX_TREE_DEPTH = 3;
const MAX_TREE_NODES = 80;
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

export async function fetchRegistryPackage(
  packageName: string,
  fetchFn: (url: string) => Promise<Response>,
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

export async function fetchOsvAdvisories(
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

export async function fetchBundlephobiaSize(
  packageName: string,
  version: string,
  fetchFn: (url: string) => Promise<Response>,
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

export async function fetchAlternatives(
  packageName: string,
  keywords: string[],
  downloads: { lastWeek: number; growthPercent: number },
  repositoryRiskLevel: string,
  fetchFn: (url: string) => Promise<Response>,
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

export async function buildDependencyAudit(
  rootName: string,
  rootVersion: string,
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
      const childEntries = Object.entries(childDeps).slice(0, 12);
      for (const [childName, childRange] of childEntries) {
        if (nodeCount.value >= MAX_TREE_NODES) break;
        const child = await buildNode(childName, childRange, depth + 1, "prod", currentPath);
        if (child) children.push(child);
      }
    }

    return { name, version, depth, type, children };
  }

  const roots: TreeBuildNode[] = [];
  const rootDepSets: [Record<string, string>, "prod" | "dev" | "peer" | "optional"][] = [
    [dependencies, "prod"],
    [devDependencies, "dev"],
    [peerDependencies, "peer"],
    [optionalDependencies, "optional"],
  ];

  for (const [depMap, type] of rootDepSets) {
    const entries = Object.entries(depMap).slice(0, 15);
    for (const [name, range] of entries) {
      if (nodeCount.value >= MAX_TREE_NODES) break;
      const node = await buildNode(name, range, 1, type, [rootName]);
      if (node) roots.push(node);
    }
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

export async function fetchSecurityAnalytics(input: {
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
      input.version,
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
