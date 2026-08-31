import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { rerenderJobSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = rerenderJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rerender payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.job.update({
    where: { id },
    data: {
      status: "rendering",
      error: null,
      hookText: parsed.data.hookText ?? job.hookText,
      youtubeTitle: parsed.data.youtubeTitle ?? job.youtubeTitle,
      youtubeDescription: parsed.data.youtubeDescription ?? job.youtubeDescription,
      outputs: parsed.data.outputs ?? job.outputs,
      splitMode: parsed.data.splitMode ?? job.splitMode,
      sectionsJson:
        parsed.data.sectionsJson === undefined
          ? undefined
          : (parsed.data.sectionsJson as Prisma.InputJsonValue),
    },
  });

  void runPipeline(id, "rerender");
  return NextResponse.json({ id, started: "rerender" });
}
