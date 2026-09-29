"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Labels {
  title: string;
  email: string;
  password: string;
  submit: string;
  failed: string;
  unavailable: string;
}

/** 업무 계정 로그인. 계정은 운영자가 발급하며 회원가입 화면은 제공하지 않는다. */
export function StaffLogin({ labels }: { labels: Labels }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return <p className="text-muted">{labels.unavailable}</p>;
  }

  return (
    <form
      data-testid="staff-login"
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        const supabase = createBrowserClient(url, key);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        setPending(false);
        if (signInError) {
          setError(labels.failed);
          return;
        }
        router.refresh();
      }}
    >
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{labels.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{labels.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 rounded-[var(--radius-button)] border border-line bg-bg px-3"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-warm">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[var(--radius-button)] bg-primary px-4 font-semibold text-on-primary disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
