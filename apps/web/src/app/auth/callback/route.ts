import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase";

/** Supabase 이메일 확인·비밀번호 재설정 후 서버 쿠키 세션으로 교환한다. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const destination = next && /^\/(zh-CN|ko|en)\/account(?:\/.*)?$/.test(next) ? next : "/zh-CN/account";
  const client = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, request.url));
  }
  if (client && tokenHash && (type === "email" || type === "signup" || type === "recovery" || type === "email_change")) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.redirect(new URL(`${destination}?auth=error`, request.url));
}
