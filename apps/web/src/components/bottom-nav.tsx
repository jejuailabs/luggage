"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
}

function NavIcon({ href }: { href: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (href === "") return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></svg>;
  if (href === "/luggage/book") return <svg {...common}><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 20v1m8-1v1" /></svg>;
  if (href === "/account") return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>;
  return <svg {...common}><path d="M4 13v-1a8 8 0 0 1 16 0v1M4 13H3v5h3v-5H4Zm16 0h1v5h-3v-5h2ZM18 18c0 2-2 3-6 3" /></svg>;
}

/** 고객 모바일 하단 탭 (10 문서 2절): 홈 / 예약 / 내 주문 / 고객지원. */
export function BottomNav({ locale, label, items }: { locale: string; label: string; items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="customer-bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-line pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <ul className="mx-auto grid max-w-[1120px] grid-cols-4">
        {items.map((item) => {
          const href = `/${locale}${item.href}`;
          const active = item.href === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] font-medium text-muted aria-[current=page]:font-bold aria-[current=page]:text-primary"
              >
                <NavIcon href={item.href} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
