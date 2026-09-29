import { PlaceholderPanel } from "@/components/placeholder-panel";
import { StaffGate } from "@/components/staff-gate";
import { getRequestContext, resolveLocale } from "@/lib/request-context";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const { t } = await getRequestContext(locale);
  return (
    <StaffGate locale={locale} area="partner">
      <PlaceholderPanel title={t("staff.partner")} body={t("staff.comingSoon")} />
    </StaffGate>
  );
}
