"use client";

import { useAuth } from "@/components/AuthProvider";

interface SignInPromptProps {
  title?: string;
  message?: string;
}

/**
 * Shown when a page requires authentication but the user is not signed in.
 * Renders a sign-in call-to-action themed to match the app.
 */
export default function SignInPrompt({
  title = "Sign in required",
  message = "Sign in with Google to access this page.",
}: SignInPromptProps) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center sm:py-20">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0a3d2a]/10 text-3xl">
        ⛳
      </div>
      <h1 className="text-xl font-bold text-[#0a3d2a] dark:text-green-400 sm:text-2xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      <button
        onClick={signInWithGoogle}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#c8a951] px-6 py-3 text-sm font-bold text-[#1a1a1a] shadow transition hover:bg-[#d4b76a] touch-target"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
