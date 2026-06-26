import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Sign-in failed</h1>
      <p className="text-sm text-red-600">
        {error ? `Error: ${error}` : "Something went wrong during sign-in."}
      </p>
      <Link href="/" className="text-sm underline">
        Try again
      </Link>
    </main>
  );
}
