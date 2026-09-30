import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../apps/web/public");
const [photo, font] = await Promise.all([
  readFile(path.join(root, "images/editorial-lagoon.jpg")),
  readFile(path.join(root, "fonts/PretendardVariable.woff2")),
]);
const backgrounds = `data:image/jpeg;base64,${photo.toString("base64")}`;
const fontUrl = `data:font/woff2;base64,${font.toString("base64")}`;
const copies = {
  "zh-CN": { title: "把行李交给我们，<br>把时间留给济州", body: "酒店与机场之间，轻松预约行李接送", badge: "轻装旅行" },
  ko: { title: "짐은 맡기고,<br>제주는 더 가볍게", body: "숙소와 공항 사이, 믿을 수 있는 수하물 인계", badge: "제주 커넥트" },
  en: { title: "Leave your bags.<br>Keep the island.", body: "Easy luggage handoff between your stay and the airport", badge: "JEJU CONNECT" },
};
const browser = await chromium.launch({ headless: true });
try {
  for (const [locale, copy] of Object.entries(copies)) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><style>
      @font-face{font-family:Pretendard;src:url('${fontUrl}') format('woff2');font-weight:100 900}
      *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;font-family:Pretendard,sans-serif}
      main{width:1200px;height:630px;color:white;background:linear-gradient(90deg,rgba(4,31,56,.95) 0%,rgba(4,31,56,.78) 43%,rgba(4,31,56,.10) 100%),url('${backgrounds}') center/cover;display:flex;flex-direction:column;justify-content:space-between;padding:58px 70px}
      header{display:flex;align-items:center;justify-content:space-between}header strong{font-size:28px;letter-spacing:-.03em}header span{font-size:19px;font-weight:700;padding:12px 21px;border:1px solid rgba(255,255,255,.5);border-radius:999px;background:rgba(255,255,255,.14);backdrop-filter:blur(8px)}
      .copy{display:flex;flex-direction:column;gap:19px}.eyebrow{font-size:19px;font-weight:800;letter-spacing:.18em;color:#9beced}h1{margin:0;font-size:${locale === "en" ? 72 : 68}px;letter-spacing:-.045em;line-height:1.18;font-weight:850}p{margin:0;font-size:25px;color:#e7f6fc;font-weight:500}.line{width:88px;height:6px;background:#75dadd;border-radius:9px}
    </style></head><body><main><header><strong>JEJU CONNECT</strong><span>${copy.badge}</span></header><div class="copy"><div class="eyebrow">JEJU · LUGGAGE DELIVERY</div><h1>${copy.title}</h1><p>${copy.body}</p></div><div class="line"></div></main></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, `images/og-${locale}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
}
