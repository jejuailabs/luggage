/**
 * web-view 주소를 만든다. 같은 웹 출처의 상대 경로만 허용한다 (임의 외부 주소 열기 방지).
 */
const LOCALES = ["zh-CN", "ko", "en"];

function buildWebViewUrl(webOrigin, rawPath, defaultLocale) {
  const fallback = `${webOrigin}/${defaultLocale}`;
  if (typeof rawPath !== "string" || rawPath.length === 0) return fallback;
  let path;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return fallback;
  }
  // "/zh-CN/..." 형태의 상대 경로만. "//evil" 같은 프로토콜 상대 주소와 스킴은 거부한다.
  if (!/^\/[A-Za-z0-9/_\-?=&.%]*$/.test(path) || path.startsWith("//")) return fallback;
  const locale = path.split("/")[1];
  if (LOCALES.indexOf(locale) === -1) return fallback;
  return `${webOrigin}${path}`;
}

/** 결제 페이지 쿼리 검증 */
function parsePayQuery(query) {
  const ticket = query && query.ticket;
  const orderId = query && query.orderId;
  const locale = query && query.locale;
  if (!/^[0-9a-f]{64}$/.test(ticket || "")) return null;
  if (!/^[0-9a-f-]{36}$/.test(orderId || "")) return null;
  return { ticket, orderId, locale: LOCALES.indexOf(locale) === -1 ? "zh-CN" : locale };
}

module.exports = { buildWebViewUrl, parsePayQuery };
