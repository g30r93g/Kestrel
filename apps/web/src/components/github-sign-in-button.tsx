"use client";

import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton() {
  return (
    <button
      type="button"
      onClick={() =>
        authClient.signIn.social({
          provider: "github",
          callbackURL: "/",
          errorCallbackURL: "/auth/error",
        })
      }
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
    >
      Sign in with GitHub
    </button>
  );
}
