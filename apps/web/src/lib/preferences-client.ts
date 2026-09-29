/**
 * 로그인 사용자의 언어·테마 선택을 계정에 저장한다.
 * 기기 쿠키가 이미 기준이므로 실패해도 화면 동작을 막지 않는다.
 */
export function syncPreferenceToAccount(body: { locale?: string; theme?: string }): void {
  void fetch("/api/v1/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
