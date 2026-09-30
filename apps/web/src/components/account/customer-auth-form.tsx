"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@luggage/i18n";

const labels = {
  ko: { login: "로그인", signup: "회원가입", email: "이메일", password: "비밀번호", passwordHint: "8자 이상", submitLogin: "내 짐 확인하기", submitSignup: "계정 만들기", linkEmail: "예약 기록을 유지하며 이메일 연결", checkEmail: "확인 메일을 보냈습니다. 메일의 링크를 열고 돌아오세요.", failure: "처리하지 못했습니다. 입력값과 인증 설정을 확인해 주세요.", unavailable: "현재 계정 서비스를 연결할 수 없습니다.", otherLogin: "이미 계정이 있나요? 로그인", otherSignup: "새 계정 만들기", anonNotice: "현재 기기의 비회원 예약을 계정에 연결합니다. 이메일 확인 후 비밀번호를 설정할 수 있습니다.", reset: "비밀번호 재설정 메일 보내기", resetSent: "재설정 메일을 보냈습니다." },
  "zh-CN": { login: "登录", signup: "注册", email: "邮箱", password: "密码", passwordHint: "至少 8 位", submitLogin: "查看我的行李", submitSignup: "创建账户", linkEmail: "绑定邮箱并保留当前预订", checkEmail: "确认邮件已发送。请打开邮件中的链接后返回。", failure: "操作失败。请检查输入内容和账户设置。", unavailable: "账户服务暂时不可用。", otherLogin: "已有账户？登录", otherSignup: "创建新账户", anonNotice: "当前设备上的游客预订将保留在此账户中。验证邮箱后可设置密码。", reset: "发送密码重置邮件", resetSent: "重置邮件已发送。" },
  en: { login: "Sign in", signup: "Create account", email: "Email", password: "Password", passwordHint: "At least 8 characters", submitLogin: "Find my bags", submitSignup: "Create account", linkEmail: "Link email and keep my bookings", checkEmail: "Check your email for a confirmation link, then return here.", failure: "Could not complete this request. Check your details and account settings.", unavailable: "Account service is unavailable right now.", otherLogin: "Have an account? Sign in", otherSignup: "Create a new account", anonNotice: "Your guest bookings on this device stay with this account. Verify your email before setting a password.", reset: "Send password reset email", resetSent: "Password reset email sent." },
} as const;

export function CustomerAuthForm({ locale, mode, isAnonymous }: { locale: Locale; mode: "login" | "signup"; isAnonymous: boolean }) {
  const t = labels[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return <p role="alert">{t.unavailable}</p>;
  const client = createBrowserClient(url, key);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true); setError(""); setSuccess("");
    try {
      if (mode === "login") {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(`/${locale}/account`);
        router.refresh();
      } else if (isAnonymous) {
        // 익명 주문의 owner_id를 유지하려면 새 사용자를 만들지 않고 현재 사용자의 이메일을 검증한다.
        const { error: authError } = await client.auth.updateUser({ email });
        if (authError) throw authError;
        setSuccess(t.checkEmail);
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/account` },
        });
        if (authError) throw authError;
        if (data.session) { router.replace(`/${locale}/account`); router.refresh(); }
        else setSuccess(t.checkEmail);
      }
    } catch { setError(t.failure); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    const email = (document.querySelector<HTMLInputElement>("#customer-auth-email")?.value ?? "").trim();
    if (!email) { setError(t.failure); return; }
    setBusy(true); setError("");
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/account` });
    setBusy(false);
    setSuccess(resetError ? "" : t.resetSent);
    if (resetError) setError(t.failure);
  }

  return <div className="customer-auth">
    <div className="customer-auth__intro"><span className="customer-auth__emoji" aria-hidden="true">{mode === "login" ? "🔐" : "✨"}</span><h1>{mode === "login" ? t.login : t.signup}</h1>{isAnonymous && mode === "signup" ? <p>{t.anonNotice}</p> : null}</div>
    <form onSubmit={submit} data-testid="customer-auth-form">
      <label htmlFor="customer-auth-email">{t.email}</label>
      <input id="customer-auth-email" name="email" type="email" autoComplete="email" required />
      {!(isAnonymous && mode === "signup") ? <><label htmlFor="customer-auth-password">{t.password}</label><input id="customer-auth-password" name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /><small>{mode === "signup" ? t.passwordHint : ""}</small></> : null}
      <button type="submit" className="customer-action" disabled={busy}>{mode === "login" ? t.submitLogin : isAnonymous ? t.linkEmail : t.submitSignup} ↗</button>
      {error ? <p role="alert" className="customer-auth__error">{error}</p> : null}
      {success ? <p role="status" className="customer-auth__success">{success}</p> : null}
    </form>
    <div className="customer-auth__links">{mode === "login" ? <><button type="button" onClick={resetPassword} disabled={busy}>{t.reset}</button><Link href={`/${locale}/account/signup`}>{t.otherSignup} →</Link></> : <Link href={`/${locale}/account/login`}>{t.otherLogin} →</Link>}</div>
  </div>;
}
