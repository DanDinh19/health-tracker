"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-red-800 mb-2">Something went wrong</h1>
          <pre className="bg-slate-100 p-4 rounded-lg text-sm overflow-auto mb-4 whitespace-pre-wrap">
            {error?.message ?? "An unexpected error occurred"}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
