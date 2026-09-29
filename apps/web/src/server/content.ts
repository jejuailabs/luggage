import "server-only";
import { createClient } from "@supabase/supabase-js";
import { resolveContent, type ContentCriticality, type Locale, type PublishedTranslation, type ResolvedContent } from "@luggage/i18n";
import type { RouteType } from "@luggage/domain";
import { getServerConfig } from "@/lib/env";
import { CONTENT_FIXTURES } from "./content-fixtures";

export type ContentKind = "guide" | "faq" | "notice" | "legal";

export interface ContentRecord {
  slug: string;
  kind: ContentKind;
  criticality: ContentCriticality;
  sortOrder: number;
  /** 상황별 안내가 연결하는 노선 */
  relatedRoute?: RouteType | null;
  translations: PublishedTranslation[];
}

export type ContentResult = ResolvedContent | { status: "unavailable" };

/**
 * 공개 콘텐츠 저장소. 게시(published)된 번역만 읽는다.
 * - supabase: 공개 키 + RLS (개인화 없음, 쿠키 미사용)
 * - fixture: 로컬·E2E용 합성 데이터. production에서는 사용할 수 없다.
 */
interface ContentSource {
  listByKind(kind: ContentKind): Promise<ContentRecord[] | null>;
  getBySlug(slug: string): Promise<ContentRecord | null | undefined>;
}

const fixtureSource: ContentSource = {
  async listByKind(kind) {
    return CONTENT_FIXTURES.filter((c) => c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async getBySlug(slug) {
    return CONTENT_FIXTURES.find((c) => c.slug === slug) ?? null;
  },
};

interface ContentRow {
  slug: string;
  kind: ContentKind;
  criticality: ContentCriticality;
  sort_order: number;
  related_route: RouteType | null;
  content_translations: { locale: string; title: string; body: string }[];
}

function toRecord(row: ContentRow): ContentRecord {
  return {
    slug: row.slug,
    kind: row.kind,
    criticality: row.criticality,
    sortOrder: row.sort_order,
    relatedRoute: row.related_route,
    translations: row.content_translations,
  };
}

function supabaseSource(url: string, key: string): ContentSource {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const columns = "slug, kind, criticality, sort_order, related_route, content_translations(locale, title, body)";
  return {
    async listByKind(kind) {
      const { data, error } = await client.from("content_items").select(columns).eq("kind", kind).order("sort_order");
      if (error) return null;
      return (data as unknown as ContentRow[]).map(toRecord);
    },
    async getBySlug(slug) {
      const { data, error } = await client.from("content_items").select(columns).eq("slug", slug).maybeSingle();
      if (error) return undefined;
      return data ? toRecord(data as unknown as ContentRow) : null;
    },
  };
}

function getSource(): ContentSource | null {
  const config = getServerConfig();
  if (config.publicDataSource === "fixture") return fixtureSource;
  if (!config.supabase) return null;
  return supabaseSource(config.supabase.url, config.supabase.publishableKey);
}

/** undefined: 조회 실패, null: 없음 */
export async function getContentRecord(slug: string): Promise<ContentRecord | null | undefined> {
  const source = getSource();
  if (!source) return undefined;
  return source.getBySlug(slug);
}

export async function getContent(slug: string, locale: Locale): Promise<ContentResult> {
  const record = await getContentRecord(slug);
  if (record === undefined) return { status: "unavailable" };
  if (record === null) return { status: "missing" };
  return resolveContent(record.translations, locale, record.criticality);
}

export async function listContent(kind: ContentKind, locale: Locale) {
  const source = getSource();
  const records = source ? await source.listByKind(kind) : null;
  if (!records) return null;
  return records
    .map((record) => ({ slug: record.slug, result: resolveContent(record.translations, locale, record.criticality) }))
    .filter((entry) => entry.result.status !== "missing");
}
