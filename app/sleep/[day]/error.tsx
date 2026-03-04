"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SleepError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sleep page error:", error);
  }, [error]);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-red-800 mb-2">Sleep timeline error</h1>
      <p className="text-slate-600 mb-2">{error?.message ?? "An error occurred"}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-slate-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium py-2"
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}
