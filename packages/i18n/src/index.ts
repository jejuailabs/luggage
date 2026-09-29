import { IntlMessageFormat } from "intl-messageformat";
import { type Locale } from "./locales";
import { en } from "./messages/en";
import { ko } from "./messages/ko";
import { zhCN, type MessageKey, type Messages } from "./messages/zh-CN";

export * from "./content";
export * from "./locales";
export type { MessageKey, Messages };

const CATALOG: Record<Locale, Messages> = { "zh-CN": zhCN, ko, en };

export function getMessages(locale: Locale): Messages {
  return CATALOG[locale];
}

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** ICU 메시지 형식으로 변수·복수형을 처리한다. 문장을 조각내어 이어 붙이지 않는다. */
export function createTranslator(locale: Locale): Translate {
  const messages = CATALOG[locale];
  const cache = new Map<MessageKey, IntlMessageFormat>();
  return (key, values) => {
    const template = messages[key];
    if (!values) return template;
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = new IntlMessageFormat(template, locale);
      cache.set(key, formatter);
    }
    return String(formatter.format(values));
  };
}

export const SERVICE_TIME_ZONE = "Asia/Seoul";

/** 고객 기기 시간대와 관계없이 한국 시간으로 표시한다. */
export function formatKst(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: SERVICE_TIME_ZONE }).format(date);
}

/** 금액은 통화 최소 단위 정수로 받는다. KRW는 원 단위다. */
export function formatMoney(amountMinor: number, currency: string, locale: Locale): string {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError("amountMinor must be an integer in the currency's minor unit");
  }
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
  return formatter.format(amountMinor / 10 ** digits);
}
