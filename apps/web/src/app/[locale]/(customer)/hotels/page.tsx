import { redirect } from "next/navigation";
import { resolveLocale } from "@/lib/request-context";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[]; stay?: string | string[]; route?: string | string[] }> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 이전 숙소 찾기 링크를 하나의 예약 흐름으로 합친다. */
export default async function HotelsRedirect({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const query = await searchParams;
  const target = new URLSearchParams();
  for (const key of ["q", "stay", "route"] as const) {
    const value = first(query[key]);
    if (value) target.set(key, value.slice(0, 80));
  }
  redirect(`/${locale}/luggage/book${target.size ? `?${target}` : ""}`);
}
