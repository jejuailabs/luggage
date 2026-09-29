import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { StaffRole } from "@luggage/domain";
import { getServerConfig } from "@/lib/env";

export interface NotificationPlan {
  audience: { userIds?: string[]; roles?: StaffRole[] };
  title: string;
  body: string;
  url: string;
}

const INCIDENT_KO: Record<string, string> = {
  missing_at_origin: "호텔에서 짐 없음",
  damage: "외관 손상",
  quantity_mismatch: "수량 불일치",
  vehicle_breakdown: "차량 고장",
  delay: "지연",
  flight_change: "항공편 변경",
  customer_no_show: "고객 미도착",
  partial_missing: "일부 누락",
  lost: "분실",
  location_change: "인계 장소 변경",
  other: "기타",
};

/**
 * outbox 이벤트 → 업무자 알림 (한국어 업무 화면).
 * 고객 알림(이메일·위챗 구독 메시지)은 발송 채널 연동 후 추가한다 — 지금은 계획하지 않는다(null).
 * 알림 본문에 고객 연락처·결제 정보를 넣지 않는다.
 */
export function planNotification(topic: string, payload: Record<string, unknown>, aggregateId: string): NotificationPlan | null {
  switch (topic) {
    case "job.assigned":
      return typeof payload.driver_id === "string"
        ? { audience: { userIds: [payload.driver_id] }, title: "새 배송 작업", body: "배정된 작업을 확인하세요.", url: "/ko/driver" }
        : null;
    case "incident.opened":
      return {
        audience: { roles: ["dispatcher", "admin"] },
        title: Number(payload.severity) === 3 ? "긴급 현장 사고" : "현장 사고 보고",
        body: `${INCIDENT_KO[String(payload.type)] ?? "사고"} · 운영 현황에서 확인하세요.`,
        url: "/ko/admin/dispatch",
      };
    case "support.ticket_opened":
      return {
        audience: { roles: ["support", "dispatcher", "admin"] },
        title: "새 고객 문의",
        body: `고객 언어 ${String(payload.locale ?? "")}`,
        url: `/ko/admin/support/${aggregateId}`,
      };
    case "order.needs_review":
    case "payment.amount_mismatch":
    case "payment.duplicate_capture":
    case "payment.unexpected_capture":
      return {
        audience: { roles: ["dispatcher", "finance", "admin"] },
        title: "운영 확인 필요",
        body: topic.startsWith("payment.") ? "결제 대사 결과를 검토하세요." : "확정하지 못한 주문을 검토하세요.",
        url: "/ko/admin/dispatch",
      };
    case "refund.requested":
      return { audience: { roles: ["finance", "admin"] }, title: "환불 요청", body: "고객 취소에 따른 환불 요청을 검토하세요.", url: "/ko/admin" };
    default:
      return null;
  }
}

interface OutboxRow {
  id: string;
  topic: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
}

function pushConfigured(): boolean {
  const { webPush } = getServerConfig();
  if (!webPush) return false;
  webpush.setVapidDetails(webPush.subject, webPush.publicKey, webPush.privateKey);
  return true;
}

async function resolveAudience(service: SupabaseClient, audience: NotificationPlan["audience"]): Promise<string[]> {
  const ids = new Set(audience.userIds ?? []);
  if (audience.roles?.length) {
    const { data } = await service.from("role_assignments").select("user_id").in("role", audience.roles);
    for (const row of data ?? []) ids.add(row.user_id);
  }
  return [...ids];
}

async function pushTo(service: SupabaseClient, userIds: string[], plan: NotificationPlan): Promise<number> {
  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .in("user_id", userIds);
  let delivered = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: plan.title, body: plan.body, url: plan.url }),
        { TTL: 3600 },
      );
      delivered += 1;
      await service.from("push_subscriptions").update({ failure_count: 0, last_success_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // 만료된 구독은 지운다.
        await service.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        await service.from("push_subscriptions").update({ failure_count: sub.failure_count + 1 }).eq("id", sub.id);
      }
    }
  }
  return delivered;
}

/**
 * outbox를 한 묶음 처리한다. 알림함 기록이 곧 처리 완료이며, 웹 푸시 실패는 업무 기록을 바꾸지 않는다.
 */
export async function dispatchOutbox(service: SupabaseClient, limit = 50) {
  const { data, error } = await service.rpc("claim_outbox", { p_limit: limit, p_lease_seconds: 120 });
  if (error) throw new Error("claim failed");
  const events = (data ?? []) as OutboxRow[];
  const canPush = pushConfigured();
  let notified = 0;
  let pushed = 0;
  let failed = 0;
  for (const event of events) {
    try {
      const plan = planNotification(event.topic, event.payload ?? {}, event.aggregate_id);
      if (plan) {
        const userIds = await resolveAudience(service, plan.audience);
        if (userIds.length > 0) {
          const { error: insertError } = await service.from("notifications").upsert(
            userIds.map((userId) => ({
              user_id: userId,
              topic: event.topic,
              title: plan.title,
              body: plan.body,
              url: plan.url,
              outbox_event_id: event.id,
            })),
            { onConflict: "user_id,outbox_event_id", ignoreDuplicates: true },
          );
          if (insertError) throw new Error("notification insert failed");
          notified += userIds.length;
          if (canPush) pushed += await pushTo(service, userIds, plan);
        }
      }
      await service.rpc("complete_outbox", { p_id: event.id, p_ok: true });
    } catch (e) {
      failed += 1;
      await service.rpc("complete_outbox", { p_id: event.id, p_ok: false, p_error: e instanceof Error ? e.message : "error" });
    }
  }
  return { claimed: events.length, notified, pushed, failed };
}
