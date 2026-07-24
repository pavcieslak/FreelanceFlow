"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">ProjectFlow</h1>
          <p className="text-text-muted mt-2">Reset your password</p>
        </div>

        {sent ? (
          <div className="bg-surface border border-border rounded-lg p-6 text-center space-y-4">
            <MailCheck size={36} className="mx-auto text-accent" />
            <p className="text-text-primary text-sm">
              If an account exists for that email, a reset link is on its way.
            </p>
            <p className="text-text-muted text-xs">
              The link works once and expires in 60 minutes. Check your spam
              folder if it doesn't arrive.
            </p>
            <Link
              href="/login"
              className="inline-block text-accent hover:underline text-sm"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface border border-border rounded-lg p-6 space-y-4"
          >
            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <p className="text-text-muted text-sm">
              Enter the email you signed up with and we'll send you a link to
              choose a new password.
            </p>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="you@example.com"
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
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-sm text-text-muted text-center">
              Remembered it?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
