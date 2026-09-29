import Link from "next/link";
import { ADMIN_LABELS } from "@/components/admin/labels";
import { StaffGate } from "@/components/staff-gate";
import { resolveLocale } from "@/lib/request-context";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  return (
    <StaffGate locale={locale} area="admin">
      <section className="flex flex-col gap-3" lang="ko">
        <h1 className="text-xl font-bold">{ADMIN_LABELS.hub}</h1>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { href: "hotels", label: ADMIN_LABELS.hotels },
            { href: "routes", label: ADMIN_LABELS.routes },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={`/${locale}/admin/${item.href}`}
                className="flex min-h-14 items-center rounded-[var(--radius-card)] border border-line bg-card px-4 font-medium"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </StaffGate>
  );
}
