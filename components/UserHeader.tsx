"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function UserHeader() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
        <span className="text-sm text-slate-600 truncate max-w-[200px]">
          {user.email ?? "Signed in"}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
