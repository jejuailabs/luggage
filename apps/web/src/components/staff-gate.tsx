import { canEnterStaffArea, type StaffArea } from "@luggage/domain";
import type { Locale, MessageKey } from "@luggage/i18n";
import { getRequestContext } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { StaffLogin } from "./staff-login";

const AREA_TITLE: Record<StaffArea, MessageKey> = {
  driver: "staff.driver",
  partner: "staff.partner",
  admin: "staff.admin",
};

/**
 * 업무 화면 첫 관문. 로그인하지 않았으면 로그인 폼, 역할이 없으면 접근 불가를 보여 준다.
 * 개별 데이터 권한은 API·RLS에서 다시 검사한다.
 */
export async function StaffGate({
  locale,
  area,
  children,
}: {
  locale: Locale;
  area: StaffArea;
  children: React.ReactNode;
}) {
  const { t } = await getRequestContext(locale);
  const auth = await getViewer();
  const title = t(AREA_TITLE[area]);

  if (!auth.user || auth.user.isAnonymous) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-4">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-muted">{t("staff.loginRequired")}</p>
        <StaffLogin
          locale={locale}
          labels={{
            title: t("staff.login.title"),
            email: t("staff.login.email"),
            password: t("staff.login.password"),
            submit: t("staff.login.submit"),
            failed: t("staff.login.failed"),
            unavailable: t("staff.login.unavailable"),
          }}
        />
      </section>
    );
  }

  if (!canEnterStaffArea(area, auth.roles)) {
    return (
      <section className="rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="staff-no-access">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-muted">{t("staff.noAccess")}</p>
      </section>
    );
  }

  return <>{children}</>;
}
