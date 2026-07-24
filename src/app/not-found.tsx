import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center bg-surface border border-border rounded-lg p-8">
        <FileQuestion size={40} className="mx-auto text-text-muted mb-4" />
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Page not found
        </h1>
        <p className="text-text-muted text-sm mb-6">
          The page you're looking for doesn't exist or was moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-accent hover:bg-accent-hover text-white font-medium rounded px-5 py-2.5 text-sm transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
