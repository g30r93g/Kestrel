"use server";

import { getOctokit } from "./client";
import type { TagDetail } from "./types";

export async function fetchTagDetails(
  owner: string,
  repo: string,
): Promise<TagDetail[]> {
  const octokit = await getOctokit();

  const [{ data: tagList }, { data: releaseList }] = await Promise.all([
    octokit.rest.repos.listTags({ owner, repo, per_page: 100 }),
    octokit.rest.repos.listReleases({ owner, repo, per_page: 100 }),
  ]);

  const releaseByTag = new Map(releaseList.map((r) => [r.tag_name, r]));

  const details = await Promise.all(
    tagList.map(async (tag): Promise<TagDetail> => {
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
              name: release.name ?? tag.name,
              url: release.html_url,
              isPrerelease: release.prerelease,
              isDraft: release.draft,
            }
          : null,
      };
    }),
  );

  return details.sort(
    (a, b) =>
      new Date(b.tagger.date).getTime() - new Date(a.tagger.date).getTime(),
  );
}
