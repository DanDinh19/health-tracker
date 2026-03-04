"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  connected: "Oura connected successfully.",
  denied: "Oura authorization was denied.",
  error: "Oura connection error.",
  config_error: "Oura OAuth is not configured.",
  invalid_state: "Invalid or expired OAuth state. Please try again.",
  token_error: "Failed to exchange Oura token.",
  login_required: "Sign in to connect Oura.",
  supabase_error:
    "Authentication service is temporarily unavailable. Please try again in a few minutes or check status.supabase.com.",
};

export function OuraConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const ouraStatus = searchParams.get("oura");
  const ouraMessage = searchParams.get("message");

  useEffect(() => {
    fetch("/api/oura/status")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected ?? false))
      .catch(() => setConnected(false));
  }, [ouraStatus]);

  if (connected === null) return null;
  if (connected) return null;

  return (
    <section className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="font-semibold text-slate-800 mb-2">Oura Ring</h2>
      <p className="text-slate-600 text-sm mb-3">
        Connect your Oura ring to sync sleep, activity, and readiness data.
      </p>
      <a
        href="/api/oura/connect"
        className="inline-block bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-slate-700"
      >
        Connect Oura
      </a>
      {((ouraMessage && MESSAGES[ouraMessage]) || (ouraStatus && MESSAGES[ouraStatus])) && (
        <p className="mt-3 text-sm text-slate-600">
          {MESSAGES[ouraMessage ?? ""] ?? MESSAGES[ouraStatus ?? ""]}
        </p>
      )}
    </section>
  );
}
