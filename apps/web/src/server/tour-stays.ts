import "server-only";
import { getServerConfig } from "@/lib/env";
import staySnapshot from "./tour-stays-snapshot.json";

export interface TourStay {
  id: string;
  name: string;
  address: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
}

type TourItem = {
  contentid?: string | number;
  title?: string;
  addr1?: string;
  firstimage?: string;
  mapx?: string;
  mapy?: string;
};

type TourResponse = {
  response?: {
    header?: { resultCode?: string };
    body?: { totalCount?: number | string; items?: { item?: TourItem | TourItem[] } };
  };
};

const ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/searchStay2";
const PAGE_SIZE = 300;
// Public Korea Tourism Organization stay names fetched on 2026-09-30.
// Keep autocomplete usable when the upstream API or outbound network is unavailable.
const fallbackStays: TourStay[] = staySnapshot;

function numberOrNull(value: string | undefined): number | null {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : null;
}

export function parseTourStays(payload: TourResponse): { total: number; stays: TourStay[] } {
  if (payload.response?.header?.resultCode !== "0000") throw new Error("TourAPI request failed");
  const body = payload.response.body;
  const raw = body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const stays = items.flatMap((item) => {
    const id = String(item.contentid ?? "");
    const name = item.title?.trim();
    const address = item.addr1?.trim();
    if (!/^\d+$/.test(id) || !name || !address || !address.startsWith("제주")) return [];
    return [{
      id,
      name,
      address,
      image: item.firstimage?.startsWith("https://") ? item.firstimage : null,
      longitude: numberOrNull(item.mapx),
      latitude: numberOrNull(item.mapy),
    }];
  });
  return { total: Number(body?.totalCount ?? 0), stays };
}

/** 제주 법정동 시도 코드 50. 목록 전체를 서버 캐시에 보관하고 브라우저에는 키를 보내지 않는다. */
export async function listJejuTourStays(): Promise<TourStay[] | null> {
  const key = getServerConfig().tourApiServiceKey;
  if (!key) return fallbackStays;
  const all: TourStay[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(ENDPOINT);
    url.searchParams.set("serviceKey", decodeURIComponent(key));
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "JejuConnect");
    url.searchParams.set("_type", "json");
    url.searchParams.set("lDongRegnCd", "50");
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    url.searchParams.set("pageNo", String(page));
    try {
      const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return fallbackStays;
      const result = parseTourStays(await response.json() as TourResponse);
      all.push(...result.stays);
      if (all.length >= result.total || result.stays.length < PAGE_SIZE) break;
    } catch {
      return fallbackStays;
    }
  }
  return [...new Map(all.map((stay) => [stay.id, stay])).values()];
}
