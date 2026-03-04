"use client";

import { useState } from "react";

type Props = {
  message: string;
  title?: string;
};

export function ErrorWithCopy({ message, title = "Error" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded border border-red-200 bg-red-50 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-red-800">{title}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="text-xs text-red-900 whitespace-pre-wrap break-words font-sans select-text">
        {message}
      </pre>
    </div>
  );
}
