import { prisma } from "@/lib/prisma";
import { DEMO_MODE } from "@/lib/demo";
import { resetDemoData } from "@/lib/demo-seed";

/*
  Nightly demo reset, called by Vercel Cron (see vercel.json).

  Security: Vercel sends "Authorization: Bearer <CRON_SECRET>" with every cron
  request. We refuse anything without the right secret, so random visitors
  can't wipe the demo by opening this URL. It also refuses to run unless
  demo mode is on — a real customer deployment can never be reset by this.
*/
export const maxDuration = 60; // seconds — rebuilding the sample data takes a few

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!DEMO_MODE) {
    return Response.json({ error: "Demo mode is off — nothing to reset." }, { status: 409 });
  }

  const summary = await resetDemoData(prisma, process.env.DEMO_PASSWORD || "password123");
  return Response.json({ ok: true, ...summary });
}
