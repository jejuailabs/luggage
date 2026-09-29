import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDeepLinks } from "@luggage/integrations";
import { formatKst, type Locale, type Translate } from "@luggage/i18n";

/**
 * 배송 차량의 최근 위치 (07 문서 6절). 짐 자체 GPS가 아님을 명시한다.
 * 움직이는 애니메이션·예상 경로를 만들지 않고, 오래된 위치는 stale로 표시한다.
 */
export async function VehicleLocation({ client, orderId, locale, t }: { client: SupabaseClient; orderId: string; locale: Locale; t: Translate }) {
  const { data } = await client
    .rpc("latest_vehicle_location", { p_order_id: orderId })
    .maybeSingle<{ latitude: number; longitude: number; observed_at: string; stale: boolean }>();
  if (!data) return null;
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const links = mapDeepLinks(latitude, longitude, t("vehicle.mapLabel"));
  const time = formatKst(new Date(data.observed_at), locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4" data-testid="vehicle-location" data-stale={data.stale}>
      <h2 className="font-semibold">{t("vehicle.title")}</h2>
      <p className="text-xs text-muted">{t("vehicle.notBagGps")}</p>
      <p className="text-sm">
        {data.stale ? t("vehicle.stale", { time }) : t("vehicle.lastSeen", { time })}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <a href={links.amap} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-line px-3">
          {t("vehicle.openAmap")}
        </a>
        <a href={links.baidu} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-line px-3">
          {t("vehicle.openBaidu")}
        </a>
        <a href={links.apple} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-line px-3">
          {t("vehicle.openApple")}
        </a>
      </div>
    </section>
  );
}
