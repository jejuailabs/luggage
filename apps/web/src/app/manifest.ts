import type { MetadataRoute } from "next";

/**
 * PWA 설치 정보. 기사·호텔·운영 화면을 홈 화면에 설치해 쓴다 (네이티브 앱 없음).
 * 고객은 위챗 브라우저·미니프로그램이 주 채널이며 설치를 요구하지 않는다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "济州Connect · 제주 커넥트",
    short_name: "제주커넥트",
    description: "제주 짐배송 예약·현장 업무",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#0F766E",
    lang: "zh-Hans",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "기사 작업", url: "/ko/driver", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "호텔 보관", url: "/ko/partner", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "운영 현황", url: "/ko/admin/dispatch", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
