import type { Metadata } from "next";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { robots: NO_INDEX };

/** 기사·호텔·운영 화면. 고객 하단 탭을 노출하지 않는다. 권한 검사는 A03 인증에서 추가한다. */
export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { t } = await getRequestContext(await resolveLocale(params));
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col md:max-w-5xl">
      <header className="border-b border-line px-4 py-3">
        <p className="text-sm text-muted">{t("brand.name")}</p>
        <p className="font-semibold">{t("staff.title")}</p>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
