"use server";

import { getOctokit } from "./client";
import { PACKAGE_TYPES } from "./types";
import type { PackageDetail, PackageType } from "./types";

export async function fetchPackages(
  owner: string,
  repo: string,
): Promise<PackageDetail[]> {
  const octokit = await getOctokit();

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const isOrg = repoData.owner.type === "Organization";

  const results = await Promise.allSettled(
    PACKAGE_TYPES.map((type) =>
      isOrg
        ? octokit.rest.packages.listPackagesForOrganization({
            org: owner,
            package_type: type,
            per_page: 100,
          })
        : octokit.rest.packages.listPackagesForUser({
            username: owner,
            package_type: type,
            per_page: 100,
          }),
    ),
  );

  const packages: PackageDetail[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const pkg of result.value.data) {
      if (pkg.repository?.name !== repo) continue;
      packages.push({
        id: pkg.id,
        name: pkg.name,
        packageType: pkg.package_type as PackageType,
        visibility: pkg.visibility as "public" | "private",
        versionCount: pkg.version_count,
        updatedAt: pkg.updated_at,
        htmlUrl: pkg.html_url ?? "",
      });
    }
  }

  return packages.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
