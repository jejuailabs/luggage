import type { Metadata } from "next";
import { StaffToolbar } from "@/components/field/staff-toolbar";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { robots: NO_INDEX };

/** 기사·호텔·운영 화면. 고객 하단 탭을 노출하지 않는다. 화면별 역할 검사는 StaffGate가 한다. */
export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  const viewer = await getViewer();
  const signedInStaff = Boolean(viewer.user && !viewer.user.isAnonymous);
  const { count } = signedInStaff
    ? await viewer.client!.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
    : { count: 0 };

  return (
    <div className="staff-shell mx-auto flex min-h-dvh w-full max-w-[480px] flex-col md:max-w-5xl">
      <header className="staff-shell__header flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 print:hidden">
        <div>
          <p className="text-sm">{t("brand.name")}</p>
          <p className="font-semibold">{t("staff.title")}</p>
        </div>
        {signedInStaff ? <StaffToolbar locale={locale} unread={count ?? 0} /> : null}
      </header>
      <main className="staff-shell__main flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
