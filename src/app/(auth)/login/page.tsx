"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A rejected Google sign-in comes back here as ?error=..., which would
  // otherwise look like the page simply reloaded itself. Read from the URL
  // directly rather than useSearchParams, which would force this static page
  // into a Suspense boundary.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (!reason) return;
    setError(
      reason === "AccessDenied"
        ? "That Google account is not allowed to sign in on this instance."
        : "Google sign-in failed. Try again, or use your email and password."
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">ProjectFlow</h1>
          <p className="text-text-muted mt-2">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-lg p-6 space-y-4"
        >
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm font-medium text-text-muted">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-text-muted hover:text-accent transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <GoogleSignInButton label="Sign in with Google" />

          <p className="text-sm text-text-muted text-center">
            New here?{" "}
            <Link href="/register" className="text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
