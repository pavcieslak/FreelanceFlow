"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      router.push("/login");
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
          <p className="text-text-muted mt-2">Create your account</p>
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
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="Your name"
            />
          </div>

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
            <label className="block text-sm font-medium text-text-muted mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="At least 8 characters"
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
            {loading ? "Creating account…" : "Create account"}
          </button>

          <GoogleSignInButton label="Sign up with Google" />

          <p className="text-sm text-text-muted text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
