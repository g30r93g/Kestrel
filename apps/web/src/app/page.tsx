import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOctokit } from "@/lib/github";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  // The proxy redirects unauthenticated requests; this guard satisfies types.
  if (!session) redirect("/sign-in");

  const octokit = await getOctokit();
  const { data: ghUser } = await octokit.rest.users.getAuthenticated();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Kestrel</h1>
      <p className="text-sm">
        Signed in as <span className="font-medium">{ghUser.login}</span>
        {ghUser.name ? ` (${ghUser.name})` : ""}
      </p>
      <p className="text-xs text-neutral-500">
        Public repos: {ghUser.public_repos} · via live GitHub API
      </p>
      <SignOutButton />
    </main>
  );
}
