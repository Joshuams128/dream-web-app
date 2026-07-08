"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { clearSession } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Incorrect email or password");
      setSubmitting(false);
      return;
    }
    // Fresh start for whoever just logged in: never carry over the previous
    // user's in-progress measurements on a shared device.
    await clearSession();
    // Full navigation so the proxy sees the fresh session cookie.
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/imgs/logo-2.png"
            alt="Dream Build Group logo"
            width={96}
            height={96}
            priority
            className="mx-auto mb-4 h-24 w-24 object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight text-stone-100">Dream Build Group</h1>
          <p className="mt-1 text-sm text-stone-400">Sign in to the price calculator</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-stone-900 p-6 shadow-sm ring-1 ring-stone-800"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
              Email
            </span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-13 w-full rounded-xl border border-stone-700 bg-stone-900 px-4 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-13 w-full rounded-xl border border-stone-700 bg-stone-900 px-4 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 ring-1 ring-red-500/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-13 w-full items-center justify-center rounded-xl bg-amber-500 py-3.5 text-base font-semibold text-white active:bg-amber-600 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
