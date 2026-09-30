export interface QuoteRow {
  id: string;
  route_type: string;
  bag_counts: { standard: number; large: number };
  line_items: { size: string; quantity: number; unit_amount_minor: number; amount_minor: number }[];
  subtotal_minor: number;
  discount_minor: number;
  total_minor: number;
  tax_minor: number;
  currency: string;
  expires_at: string;
}

/** 견적 응답 DTO. 금액은 모두 서버(DB)가 계산한 값이다. */
export function toQuoteDto(data: QuoteRow) {
  return {
    quoteId: data.id,
    routeType: data.route_type,
    bags: data.bag_counts,
    lineItems: data.line_items.map((item) => ({
      size: item.size,
      quantity: item.quantity,
      unitAmountMinor: item.unit_amount_minor,
      amountMinor: item.amount_minor,
    })),
    subtotalMinor: data.subtotal_minor,
    discountMinor: data.discount_minor,
    totalMinor: data.total_minor,
    taxIncludedMinor: data.tax_minor,
    currency: data.currency,
    expiresAt: data.expires_at,
  };
}
