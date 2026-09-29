import Link from "next/link";
import { resolveLocale } from "@/lib/request-context";
import { getViewer } from "@/server/auth";
import { StaffLogin } from "@/components/staff-login";

/** 업무자 알림함. 푸시가 꺼져 있거나 실패해도 여기서 확인할 수 있다. 열면 읽음 처리한다. */
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  if (!viewer.user || viewer.user.isAnonymous || !viewer.client) {
    return (
      <section lang="ko" className="rounded-[var(--radius-card)] border border-line bg-card p-4">
        <StaffLogin
          locale={locale}
          labels={{
            title: "업무 계정 로그인",
            email: "이메일",
            password: "비밀번호",
            submit: "로그인",
            failed: "이메일 또는 비밀번호가 올바르지 않습니다.",
            unavailable: "로그인 설정이 아직 없습니다.",
          }}
        />
      </section>
    );
  }
  const { data } = await viewer.client
    .from("notifications")
    .select("id, title, body, url, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const unreadIds = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);
  if (unreadIds.length > 0) {
    await viewer.client.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  }

  return (
    <section className="flex flex-col gap-3" lang="ko">
      <h1 className="text-xl font-bold">알림함</h1>
      {(data ?? []).length === 0 ? <p className="text-muted">알림이 없습니다.</p> : null}
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((n) => (
          <li key={n.id} className={`rounded-[var(--radius-card)] border bg-card p-4 text-sm ${n.read_at ? "border-line" : "border-primary"}`}>
            <p className="font-semibold">{n.title}</p>
            <p>{n.body}</p>
            <p className="text-xs text-muted">
              {new Intl.DateTimeFormat("ko", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(n.created_at))}
            </p>
            {n.url ? (
              <Link href={n.url} className="inline-flex min-h-11 items-center text-primary underline">
                열기
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
