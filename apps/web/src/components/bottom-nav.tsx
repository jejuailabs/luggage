"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
}

/** 고객 모바일 하단 탭 (10 문서 2절): 홈 / 예약 / 내 주문 / 고객지원. */
export function BottomNav({ locale, label, items }: { locale: string; label: string; items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-[480px] grid-cols-4 md:max-w-3xl">
        {items.map((item) => {
          const href = `/${locale}${item.href}`;
          const active = item.href === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 items-center justify-center px-1 text-center text-sm text-muted aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
