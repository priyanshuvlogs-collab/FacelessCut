import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { rerunJobSchema } from "@/lib/schemas";

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

  const parsed = rerunJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rerun payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.job.update({
    where: { id },
    data: {
      status: "cleaning",
      error: null,
      style: parsed.data.style ?? job.style,
      hookMode: parsed.data.hookMode ?? job.hookMode,
      customHook:
        parsed.data.customHook === undefined ? job.customHook : parsed.data.customHook,
      outputs: parsed.data.outputs ?? job.outputs,
      splitMode: parsed.data.splitMode ?? job.splitMode,
      silenceMs: parsed.data.silenceMs ?? job.silenceMs,
      removeFillers: parsed.data.removeFillers ?? job.removeFillers,
      removeRepeats: parsed.data.removeRepeats ?? job.removeRepeats,
    },
  });

  void runPipeline(id, "rerun");
  return NextResponse.json({ id, started: "rerun" });
}
