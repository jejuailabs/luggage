import { PlaceholderPanel } from "@/components/placeholder-panel";
import { getRequestContext, resolveLocale } from "@/lib/request-context";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { t } = await getRequestContext(await resolveLocale(params));
  return <PlaceholderPanel title={t("nav.orders")} body={t("home.search.unavailable")} />;
}
