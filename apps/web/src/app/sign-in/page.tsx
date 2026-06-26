import { GitHubSignInButton } from "@/components/github-sign-in-button";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Sign in to Kestrel</h1>
      <GitHubSignInButton />
    </main>
  );
}
