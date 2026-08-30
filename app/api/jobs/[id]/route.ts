import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { patchJobSchema } from "@/lib/schemas";
import { serializeJob } from "@/lib/serialize";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(serializeJob(job));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const json: unknown = await request.json();
  const parsed = patchJobSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid patch payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.job.update({
    where: { id },
    data: {
      hookText: parsed.data.hookText,
      youtubeTitle: parsed.data.youtubeTitle,
      youtubeDescription: parsed.data.youtubeDescription,
      sectionsJson:
        parsed.data.sectionsJson === undefined
          ? undefined
          : (parsed.data.sectionsJson as Prisma.InputJsonValue),
    },
  });

  return NextResponse.json(serializeJob(updated));
}
