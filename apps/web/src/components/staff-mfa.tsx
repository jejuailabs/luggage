"use client";

import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Factor = { id: string; status?: string };

/** 관리자·재무·배차 담당자의 TOTP 등록/추가 인증. QR 비밀값은 브라우저 밖으로 전송하지 않는다. */
export function StaffMfa() {
  const router = useRouter();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const existing = (data?.totp ?? []).find((factor: Factor) => factor.status === "verified");
      if (existing) setFactorId(existing.id);
    });
  }, [url, key]);
  if (!url || !key) return <p>인증 서비스를 연결할 수 없습니다.</p>;
  const supabase = createBrowserClient(url, key);
  async function enroll() {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Jeju Connect staff" });
    setBusy(false);
    if (error || !data?.totp) { setMessage("인증 앱 등록을 시작하지 못했습니다. 관리자에게 MFA 설정을 확인해 달라고 요청하세요."); return; }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (code.length !== 6 || !factorId) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { setMessage("코드를 확인하지 못했습니다. 인증 앱의 현재 6자리 코드를 다시 입력하세요."); return; }
    setQr(""); setSecret(""); setCode(""); router.refresh();
  }
  return <section lang="ko" className="mx-auto max-w-lg rounded-[var(--radius-card)] border border-line bg-card p-6" data-testid="staff-mfa"><span className="text-xs font-bold tracking-widest text-primary">SECURE ACCESS</span><h1 className="mt-2 text-2xl font-bold">2단계 인증</h1><p className="mt-2 text-sm text-muted">관리자·재무·배차 업무를 열려면 인증 앱의 6자리 코드가 필요합니다.</p>{!factorId ? <button type="button" disabled={busy} onClick={enroll} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-on-primary">인증 앱 등록하기</button> : <><div className="mt-5 rounded-xl bg-bg p-4">{qr ? <><p className="text-sm font-semibold">인증 앱에서 QR을 스캔하세요.</p><Image src={qr} alt="인증 앱 등록 QR" width={190} height={190} unoptimized className="mx-auto my-3 bg-white p-2" /><p className="break-all text-xs text-muted">직접 입력 키: {secret}</p></> : <p className="text-sm">등록된 인증 앱에서 현재 코드를 확인하세요.</p>}</div><form className="mt-4 grid gap-3" onSubmit={verify}><label className="text-sm">6자리 인증 코드<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-center font-mono text-lg tracking-widest" /></label><button disabled={busy || code.length !== 6} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50">코드 확인 후 계속</button></form></>}{message ? <p role="alert" className="mt-3 text-sm text-warm">{message}</p> : null}</section>;
}
