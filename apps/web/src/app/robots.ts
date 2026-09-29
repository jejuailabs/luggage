import type { MetadataRoute } from "next";
import { getServerConfig } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const { appUrl, appEnv } = getServerConfig();
  if (appEnv !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/driver", "/*/partner", "/*/admin", "/*/account", "/*/orders/", "/*/checkout/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
