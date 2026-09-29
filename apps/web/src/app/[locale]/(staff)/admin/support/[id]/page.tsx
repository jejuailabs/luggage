import { StaffGate } from "@/components/staff-gate";
import { MessageForm } from "@/components/support/message-form";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 고객지원 스레드. 내부 메모와 고객 메시지를 색·표시로 분리해 오발송을 막는다. */
async function Thread({ id }: { id: string }) {
  const viewer = await getViewer();
  const client = viewer.client!;
  const { data: ticket } = UUID.test(id)
    ? await client
        .from("support_tickets")
        .select("id, subject, locale, status, created_at, order:orders(public_code, reservation_status)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  if (!ticket) return <p lang="ko">문의를 찾을 수 없습니다.</p>;
  const { data: messages } = await client
    .from("support_messages")
    .select("id, author_role, visibility, body, created_at")
    .eq("ticket_id", id)
    .order("created_at");
  const order = ticket.order as unknown as { public_code: string; reservation_status: string } | null;

  return (
    <div className="flex flex-col gap-4" lang="ko">
      <section className="rounded-[var(--radius-card)] bg-sea p-4">
        <h1 className="text-xl font-bold">{ticket.subject}</h1>
        <p className="text-sm text-muted">
          고객 언어 {ticket.locale} · 상태 {ticket.status}
          {order ? ` · 주문 ${order.public_code} (${order.reservation_status})` : ""}
        </p>
      </section>
      <ol className="flex flex-col gap-2">
        {(messages ?? []).map((message) => (
          <li
            key={message.id}
            data-visibility={message.visibility}
            className={
              message.visibility === "internal"
                ? "rounded-[var(--radius-button)] border border-dashed border-warm p-3 text-sm"
                : "rounded-[var(--radius-button)] border border-line bg-card p-3 text-sm"
            }
          >
            <p className="mb-1 text-xs text-muted">
              {message.visibility === "internal" ? "내부 메모" : message.author_role === "customer" ? "고객" : "고객에게 보냄"} ·{" "}
              {new Intl.DateTimeFormat("ko", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(message.created_at))}
            </p>
            <p className="whitespace-pre-line">{message.body}</p>
          </li>
        ))}
      </ol>
      <MessageForm ticketId={ticket.id} staff labels={{ placeholder: "답장 또는 내부 메모", send: "저장", failed: "저장하지 못했습니다." }} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  return (
    <StaffGate locale={locale} area="admin">
      <Thread id={id} />
    </StaffGate>
  );
}
