import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@luggage/i18n";
import { MockCheckout } from "@/components/booking/mock-checkout";
import { getServerConfig } from "@/lib/env";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { robots: NO_INDEX };

type Props = { params: Promise<{ locale: string; attemptId: string }>; searchParams: Promise<{ return?: string }> };

/** 개발·테스트 전용 모의 결제창. production 또는 mock이 아닌 결제 모드에서는 존재하지 않는다. */
export default async function MockPayPage({ params, searchParams }: Props) {
  const config = getServerConfig();
  if (config.appEnv === "production" || config.integrations.payment !== "mock") notFound();
  const locale = await resolveLocale(params);
  const { attemptId } = await params;
  const { t } = await getRequestContext(locale);
  const viewer = await getViewer();
  const { data: attempt } = viewer.client
    ? await viewer.client.from("payment_attempts").select("id, order_id, amount_minor, currency").eq("id", attemptId).maybeSingle()
    : { data: null };
  if (!attempt) notFound();

  // 돌아갈 주소는 같은 서비스의 주문 화면만 허용한다 (열린 리디렉션 방지).
  const requested = (await searchParams).return ?? "";
  const fallback = `/${locale}/orders/${attempt.order_id}`;
  const returnUrl = requested.startsWith(`${config.appUrl}/`) ? requested : fallback;

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border-2 border-dashed border-warm bg-card p-4">
      <h1 className="text-xl font-bold">{t("mockpay.title")}</h1>
      <p className="text-sm text-muted">{t("mockpay.notice")}</p>
      <p className="text-2xl font-bold" data-testid="mock-pay-amount">
        {formatMoney(attempt.amount_minor, attempt.currency, locale)}
      </p>
      <MockCheckout
        attemptId={attempt.id}
        returnUrl={returnUrl}
        labels={{
          succeed: t("mockpay.succeed"),
          fail: t("mockpay.fail"),
          cancel: t("mockpay.cancel"),
          error: t("payment.unavailable"),
        }}
      />
    </section>
  );
}
