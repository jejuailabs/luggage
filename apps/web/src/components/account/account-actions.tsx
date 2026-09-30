"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Locale } from "@luggage/i18n";

export function AccountActions({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const labels = locale === "ko" ? { password: "비밀번호 설정·변경", save: "저장", signout: "로그아웃", saved: "비밀번호를 변경했습니다." } : locale === "zh-CN" ? { password: "设置或更改密码", save: "保存", signout: "退出登录", saved: "密码已更新。" } : { password: "Set or change password", save: "Save", signout: "Sign out", saved: "Password updated." };
  const client = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await client().auth.updateUser({ password });
    setMessage(error?.message ?? labels.saved);
    if (!error) setPassword("");
  }
  async function signOut() {
    await client().auth.signOut();
    router.push(`/${locale}/account`);
    router.refresh();
  }
  return <div className="account-actions"><form onSubmit={updatePassword}><label htmlFor="account-password">{labels.password}</label><div><input id="account-password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="submit">{labels.save}</button></div></form><button type="button" className="account-actions__signout" onClick={signOut}>{labels.signout} ↗</button>{message ? <p role="status">{message}</p> : null}</div>;
}
