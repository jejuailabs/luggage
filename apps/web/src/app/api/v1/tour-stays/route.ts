import { fail, newRequestId, ok } from "@/server/api";
import { listJejuTourStays } from "@/server/tour-stays";

export async function GET() {
  const requestId = newRequestId();
  const stays = await listJejuTourStays();
  if (!stays) return fail("PROVIDER_UNAVAILABLE", requestId);
  return ok({ stays, count: stays.length }, requestId);
}
