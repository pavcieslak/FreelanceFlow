"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordReset";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center space-y-4">
        <p className="text-text-primary text-sm">
          This reset link is missing its token.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-accent hover:underline text-sm"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center space-y-4">
        <CheckCircle2 size={36} className="mx-auto text-accent" />
        <p className="text-text-primary text-sm">Your password has been updated.</p>
        <p className="text-text-muted text-xs">
          Any other devices that were signed in have been signed out. Taking you
          to the sign-in page…
        </p>
        <Link href="/login" className="inline-block text-accent hover:underline text-sm">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
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
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
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
        {loading ? "Updating…" : "Set new password"}
      </button>

      <p className="text-sm text-text-muted text-center">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">ProjectFlow</h1>
          <p className="text-text-muted mt-2">Choose a new password</p>
        </div>
        {/* useSearchParams needs a Suspense boundary during prerendering. */}
        <Suspense
          fallback={
            <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-muted text-sm">
              Loading…
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
