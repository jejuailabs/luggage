export type AdminFetchResult = { ok: true; data: unknown } | { ok: false; code: string };

/** 관리 API 호출. 쿠키 세션과 동일 출처로 보낸다. */
export async function adminFetch(url: string, method: "POST" | "PATCH", body: unknown): Promise<AdminFetchResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: json?.data };
    return { ok: false, code: json?.error?.code ?? "INTERNAL_ERROR" };
  } catch {
    return { ok: false, code: "PROVIDER_UNAVAILABLE" };
  }
}
