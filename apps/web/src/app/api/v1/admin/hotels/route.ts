import { z } from "zod";
import { fail, newRequestId, ok } from "@/server/api";
import { dbErrorCode, requireAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const bodySchema = z
  .object({
    zoneId: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(80),
    nameKo: z.string().trim().min(1).max(120),
    addressKo: z.string().trim().min(1).max(300),
    frontDeskOpensAt: time.optional(),
    frontDeskClosesAt: time.optional(),
    translations: z
      .array(
        z.object({
          locale: z.enum(["zh-CN", "en"]),
          name: z.string().trim().min(1).max(120),
          aliases: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
        }),
      )
      .max(2)
      .default([]),
  })
  .strict()
  .refine((v) => (v.frontDeskOpensAt === undefined) === (v.frontDeskClosesAt === undefined), { path: ["frontDeskClosesAt"] });

/** 호텔 지점 등록. 초안(draft)으로 만들고 활성화는 별도 변경으로 한다. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const gate = await requireAdmin(request, requestId);
  if (!gate.ok) return gate.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), "admin.invalidField"]));
    return fail("VALIDATION_FAILED", requestId, { fieldErrors });
  }
  const body = parsed.data;
  const { client } = gate.auth;

  const { data: hotel, error } = await client
    .from("hotels")
    .insert({
      zone_id: body.zoneId,
      slug: body.slug,
      name_ko: body.nameKo,
      address_ko: body.addressKo,
      front_desk_opens_at: body.frontDeskOpensAt ?? null,
      front_desk_closes_at: body.frontDeskClosesAt ?? null,
    })
    .select("id, slug, status")
    .single();
  if (error || !hotel) return fail(dbErrorCode(error), requestId);

  if (body.translations.length > 0) {
    const { error: translationError } = await client.from("hotel_translations").insert(
      body.translations.map((t) => ({ hotel_id: hotel.id, locale: t.locale, name: t.name, aliases: t.aliases })),
    );
    // 번역 저장 실패는 호텔 초안을 지우지 않는다. 관리자가 다시 입력한다.
    if (translationError) return ok({ ...hotel, translationsSaved: false }, requestId, { status: 201 });
  }
  return ok({ ...hotel, translationsSaved: true }, requestId, { status: 201 });
}
