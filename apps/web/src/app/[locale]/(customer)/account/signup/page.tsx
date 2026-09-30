import type { Metadata } from "next";
import { CustomerAuthForm } from "@/components/account/customer-auth-form";
import { resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { robots: NO_INDEX };
export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  return <div className="customer-auth-page"><CustomerAuthForm locale={locale} mode="signup" isAnonymous={Boolean(viewer.user?.isAnonymous)} /></div>;
}
