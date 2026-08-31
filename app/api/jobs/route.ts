import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { createJobSchema } from "@/lib/schemas";
import { serializeJob } from "@/lib/serialize";
import { publicUrlForKey } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}

export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const parsed = createJobSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid job payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const job = await prisma.job.create({
      data: {
        status: "uploading",
        sourceKey: data.sourceKey,
        sourceUrl: publicUrlForKey(data.sourceKey, data.sourceUrl),
        style: data.style,
        hookMode: data.hookMode,
        customHook: data.customHook,
        outputs: data.outputs,
        splitMode: data.splitMode,
        silenceMs: data.silenceMs,
        removeFillers: data.removeFillers,
        removeRepeats: data.removeRepeats,
      },
    });

    void runPipeline(job.id, "full");
    return NextResponse.json({ id: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
