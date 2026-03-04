"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorWithCopy } from "@/components/ErrorWithCopy";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const errorParam = searchParams.get("error");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        let text = error.message;
        if (error.message?.includes("something went wrong") || error.message?.includes("prxiYo6u")) {
          text = "Supabase Auth is temporarily unavailable. Please try again in a few minutes. If it persists, check your Supabase project status at status.supabase.com.";
        } else if (error.status) {
          text += ` (${error.status})`;
        }
        setMessage({ type: "error", text });
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        let text = error.message;
        if (error.message?.includes("something went wrong") || error.message?.includes("prxiYo6u")) {
          text = "Supabase Auth is temporarily unavailable. Please try again in a few minutes. If it persists, check status.supabase.com.";
        }
        setMessage({ type: "error", text });
        return;
      }
      setMessage({
        type: "success",
        text: "Check your email for the confirmation link, then sign in.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (errorParam === "supabase_unavailable") {
      setMessage({
        type: "error",
        text: "Authentication service is temporarily unavailable. Please try again in a few minutes or check status.supabase.com.",
      });
    }
  }, [errorParam]);

  return (
    <main className="max-w-sm mx-auto p-6 mt-12">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Sign in</h1>
      <p className="text-slate-600 text-sm mb-4">
        Sign in to connect your Oura ring. Don&apos;t have an account? Use the sign up form below.
      </p>
      <form onSubmit={handleSignIn} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-slate-300 rounded px-3 py-2"
        />
        {message && (
          message.type === "error" ? (
            <ErrorWithCopy message={message.text} title="Error" />
          ) : (
            <p className="text-sm text-green-600">{message.text}</p>
          )
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-slate-800 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 border border-slate-300 rounded py-2 font-medium disabled:opacity-50"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="max-w-sm mx-auto p-6 mt-12"><p className="text-slate-500">Loading…</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
