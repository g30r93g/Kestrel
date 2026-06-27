"use server";

import { getOctokit } from "./client";
import type { TagsAndReleasesItem } from "./types";

export async function fetchTagNames(
  owner: string,
  repo: string,
): Promise<string[]> {
  const octokit = await getOctokit();
  try {
    const { data } = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((t) => t.name);
  } catch {
    return [];
  }
}

export async function fetchTagsAndReleases(
  owner: string,
  repo: string,
): Promise<TagsAndReleasesItem[]> {
  const octokit = await getOctokit();

  const [{ data: tagList }, { data: releaseList }] = await Promise.all([
    octokit.rest.repos.listTags({ owner, repo, per_page: 100 }),
    octokit.rest.repos.listReleases({ owner, repo, per_page: 100 }),
  ]);

  let latestReleaseId: number | null = null;
  for (const r of releaseList) {
    if (!r.draft && !r.prerelease) {
      latestReleaseId = r.id;
      break;
    }
  }

  const releaseByTag = new Map(releaseList.map((r) => [r.tag_name, r]));

  const items = await Promise.all(
    tagList.map(async (tag): Promise<TagsAndReleasesItem> => {
      const [refRes, commitRes] = await Promise.allSettled([
        octokit.rest.git.getRef({ owner, repo, ref: `tags/${tag.name}` }),
        octokit.rest.repos.getCommit({ owner, repo, ref: tag.commit.sha }),
      ]);

      const ref = refRes.status === "fulfilled" ? refRes.value.data : null;
      const commit =
        commitRes.status === "fulfilled" ? commitRes.value.data : null;

      const isAnnotated = ref?.object.type === "tag";
      let message = "";
      let date = commit?.commit.author?.date ?? "";

      if (isAnnotated && ref) {
        const tagObj = await octokit.rest.git
          .getTag({ owner, repo, tag_sha: ref.object.sha })
          .catch(() => null);
        if (tagObj) {
          message = tagObj.data.message ?? "";
          date = tagObj.data.tagger.date ?? date;
        }
      }

      const release = releaseByTag.get(tag.name) ?? null;

      return {
        name: tag.name,
        sha: tag.commit.sha,
        kind: isAnnotated ? "annotated" : "lightweight",
        message,
        tagger: {
          name: commit?.commit.author?.name ?? commit?.author?.login ?? "",
          login: commit?.author?.login ?? "",
          avatarUrl: commit?.author?.avatar_url ?? "",
          date,
        },
        zipballUrl: tag.zipball_url,
        tarballUrl: tag.tarball_url,
        release: release
          ? {
              id: release.id,
              title: release.name ?? tag.name,
              body: release.body ?? "",
              htmlUrl: release.html_url,
              isDraft: release.draft,
              isPrerelease: release.prerelease,
              isLatest: release.id === latestReleaseId,
              publishedAt: release.published_at ?? "",
              author: {
                login: release.author.login,
                avatarUrl: release.author.avatar_url,
              },
              assets: release.assets.map((a) => ({
                id: a.id,
                name: a.name,
                size: a.size,
                downloadCount: a.download_count,
                downloadUrl: a.browser_download_url,
              })),
            }
          : null,
      };
    }),
  );

  return items.sort(
    (a, b) =>
      new Date(b.tagger.date).getTime() - new Date(a.tagger.date).getTime(),
  );
}
