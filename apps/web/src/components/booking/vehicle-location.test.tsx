import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTranslator } from "@luggage/i18n";
import { VehicleLocation } from "./vehicle-location";

function clientReturning(row: unknown): SupabaseClient {
  return { rpc: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) } as unknown as SupabaseClient;
}

async function render(row: unknown) {
  const element = await VehicleLocation({ client: clientReturning(row), orderId: "o1", locale: "zh-CN", t: createTranslator("zh-CN") });
  return element ? renderToStaticMarkup(element) : "";
}

describe("VehicleLocation", () => {
  it("says it is the vehicle, not the bag, with Korea time and non-Google map links", async () => {
    const html = await render({ latitude: "33.500", longitude: "126.531", observed_at: "2026-09-29T01:00:00Z", stale: false });
    expect(html).toContain("不是行李本身的定位");
    expect(html).toContain("最后确认 10:00");
    expect(html).toContain("uri.amap.com");
    expect(html).toContain("api.map.baidu.com");
    expect(html).not.toContain("google");
    expect(html).toContain('data-stale="false"');
  });

  it("marks an old position as stale instead of implying live tracking", async () => {
    const html = await render({ latitude: 33.5, longitude: 126.5, observed_at: "2026-09-29T00:00:00Z", stale: true });
    expect(html).toContain("位置信息较旧");
    expect(html).toContain('data-stale="true"');
  });

  it("renders nothing when there is no active position", async () => {
    expect(await render(null)).toBe("");
  });
});
