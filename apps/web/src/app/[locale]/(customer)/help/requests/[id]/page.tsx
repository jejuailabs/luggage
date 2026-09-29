import type { Metadata } from "next";
import { formatKst } from "@luggage/i18n";
import { MessageForm } from "@/components/support/message-form";
import { getRequestContext, resolveLocale } from "@/lib/request-context";
import { NO_INDEX } from "@/lib/seo";
import { getViewer } from "@/server/auth";

export const metadata: Metadata = { robots: NO_INDEX };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 고객 문의 내역. RLS가 본인 문의와 고객 공개 메시지만 돌려준다 (내부 메모 비공개). */
export default async function RequestPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await resolveLocale(params);
  const { id } = await params;
  const { t } = await getRequestContext(locale);
  const viewer = await getViewer();
  const client = viewer.user ? viewer.client : null;
  const { data: ticket } = client && UUID.test(id)
    ? await client.from("support_tickets").select("id, subject, status").eq("id", id).maybeSingle()
    : { data: null };

  const panel = "rounded-[var(--radius-card)] border border-line bg-card p-4";
  if (!ticket || !client) {
    return (
      <section className={panel} data-testid="request-not-found">
        <h1 className="text-xl font-bold">{t("support.threadTitle")}</h1>
        <p className="mt-2 text-muted">{t("support.notFound")}</p>
      </section>
    );
  }
  const { data: messages } = await client
    .from("support_messages")
    .select("id, author_role, body, created_at")
    .eq("ticket_id", id)
    .order("created_at");

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] bg-sea p-4">
        <p className="text-sm text-muted">{t("support.threadTitle")}</p>
        <h1 className="text-xl font-bold">{ticket.subject}</h1>
      </section>
      <ol className="flex flex-col gap-2">
        {(messages ?? []).map((message) => (
          <li
            key={message.id}
            className={message.author_role === "staff" ? `${panel} border-primary text-sm` : `${panel} text-sm`}
          >
            <p className="mb-1 text-xs text-muted">
              {message.author_role === "staff" ? t("support.staff") : t("support.you")} ·{" "}
              {formatKst(new Date(message.created_at), locale, { dateStyle: "short", timeStyle: "short", hourCycle: "h23" })}
            </p>
            <p className="whitespace-pre-line">{message.body}</p>
          </li>
        ))}
      </ol>
      <MessageForm
        ticketId={ticket.id}
        staff={false}
        labels={{ placeholder: t("support.reply"), send: t("support.reply"), failed: t("support.failed") }}
      />
    </div>
  );
}
