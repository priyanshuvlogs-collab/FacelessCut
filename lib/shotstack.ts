import "server-only";
import { env, isMock } from "@/lib/env";
import { mockRenderOutputs } from "@/lib/providers/mock";
import {
  submitShotstackRender,
  waitForShotstackRender,
  type ShotstackRenderRequest,
} from "@/lib/providers/shotstack";
import type { CaptionCue, KeptRange, Section, ShortOutput } from "@/lib/types";

export type RenderPlan = {
  sourceUrl: string;
  keptRanges: KeptRange[];
  hookText: string;
  captions: CaptionCue[];
  sections: Section[];
  outputs: "landscape" | "vertical" | "both";
  splitMode: "one" | "chapters" | "shorts";
};

export type RenderResult = {
  landscapeUrl: string | null;
  verticalUrl: string | null;
  shorts: ShortOutput[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function videoClips(sourceUrl: string, keptRanges: KeptRange[], offset = 0, end?: number) {
  let cleanCursor = 0;
  const clips: Array<Record<string, unknown>> = [];

  for (const range of keptRanges) {
    const length = range.end - range.start;
    const cleanStart = cleanCursor;
    const cleanEnd = cleanCursor + length;
    cleanCursor = cleanEnd;

    if (end != null && cleanStart >= end) break;
    if (cleanEnd <= offset) continue;

    const trimOffset = Math.max(0, offset - cleanStart);
    const visibleEnd = end == null ? cleanEnd : Math.min(end, cleanEnd);
    const visibleLength = visibleEnd - (cleanStart + trimOffset);
    if (visibleLength <= 0.04) continue;

    clips.push({
      asset: {
        type: "video",
        src: sourceUrl,
        trim: range.start + trimOffset,
        volume: 1,
      },
      start: cleanStart + trimOffset - offset,
      length: visibleLength,
      fit: "cover",
    });
  }

  return clips;
}

function hookClip(hookText: string, width: number, height: number) {
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:4% 6%;background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,.18));">
    <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:.04em;text-align:center;color:#F7F3EA;font-size:${height > width ? 56 : 64}px;line-height:1.05;text-transform:uppercase;">
      ${escapeHtml(hookText)}
    </div>
  </div>`;

  return {
    asset: {
      type: "html",
      html,
      width,
      height: Math.round(height * 0.28),
    },
    start: 0,
    length: 3,
    position: "top",
  };
}

function captionClips(captions: CaptionCue[], width: number, height: number) {
  return captions.map((cue) => {
    const html = cue.text
      .split(/\s+/)
      .map((word) => {
        const hit = cue.highlight.some(
          (item) => item.toLowerCase() === word.toLowerCase(),
        );
        const color = hit ? "#F5D547" : "#F7F3EA";
        return `<span style="color:${color}">${escapeHtml(word)}</span>`;
      })
      .join(" ");

    return {
      asset: {
        type: "html",
        html: `<div style="display:flex;align-items:flex-end;justify-content:center;width:100%;height:100%;padding:0 6% 6%;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:${height > width ? 54 : 46}px;line-height:1.15;text-align:center;text-transform:uppercase;background:rgba(0,0,0,.45);padding:10px 18px;border-radius:8px;">${html}</div>
        </div>`,
        width,
        height: Math.round(height * 0.18),
      },
      start: cue.start,
      length: Math.max(0.12, cue.end - cue.start),
      position: "bottom",
      transition: { in: "slideUpFast" },
    };
  });
}

function buildEdit(
  plan: RenderPlan,
  orientation: "landscape" | "vertical",
  window?: { start: number; end: number; hook: string },
): ShotstackRenderRequest {
  const width = orientation === "landscape" ? 1920 : 1080;
  const height = orientation === "landscape" ? 1080 : 1920;
  const offset = window?.start ?? 0;
  const end = window?.end;
  const hook = window?.hook ?? plan.hookText;
  const captions = plan.captions
    .filter((cue) => {
      if (end == null) return cue.end > offset;
      return cue.start < end && cue.end > offset;
    })
    .map((cue) => ({
      ...cue,
      start: Math.max(0, cue.start - offset),
      end: Math.max(0.12, (end == null ? cue.end : Math.min(cue.end, end)) - offset),
    }));

  return {
    timeline: {
      background: "#080705",
      tracks: [
        { clips: captionClips(captions, width, height) },
        { clips: [hookClip(hook, width, height)] },
        { clips: videoClips(plan.sourceUrl, plan.keptRanges, offset, end) },
      ],
    },
    output: {
      format: "mp4",
      size: { width, height },
      fps: 30,
      quality: "high",
    },
  };
}

async function renderEdit(edit: ShotstackRenderRequest): Promise<string> {
  const id = await submitShotstackRender(edit);
  return waitForShotstackRender(id);
}

export function buildShotstackEdit(
  plan: RenderPlan,
  orientation: "landscape" | "vertical",
): ShotstackRenderRequest {
  return buildEdit(plan, orientation);
}

export async function renderOutputs(plan: RenderPlan): Promise<RenderResult> {
  if (isMock() || !env.shotstack.apiKey) {
    const mock = await mockRenderOutputs();
    const shorts: ShortOutput[] =
      plan.splitMode === "shorts"
        ? plan.sections
            .filter((section) => section.includeAsShort)
            .map((section) => ({
              sectionId: section.id,
              title: section.title,
              url: mock.shortUrl,
              status: "ready" as const,
            }))
        : [];

    return {
      landscapeUrl:
        plan.outputs === "vertical" ? null : mock.landscapeUrl,
      verticalUrl: plan.outputs === "landscape" ? null : mock.verticalUrl,
      shorts,
    };
  }

  const landscapeUrl =
    plan.outputs === "vertical"
      ? null
      : await renderEdit(buildEdit(plan, "landscape"));
  const verticalUrl =
    plan.outputs === "landscape"
      ? null
      : await renderEdit(buildEdit(plan, "vertical"));

  const shorts: ShortOutput[] = [];
  if (plan.splitMode === "shorts") {
    for (const section of plan.sections.filter((item) => item.includeAsShort)) {
      try {
        const url = await renderEdit(
          buildEdit(plan, "vertical", {
            start: section.start,
            end: section.end,
            hook: section.hook,
          }),
        );
        shorts.push({
          sectionId: section.id,
          title: section.title,
          url,
          status: "ready",
        });
      } catch (error) {
        shorts.push({
          sectionId: section.id,
          title: section.title,
          url: null,
          status: "failed",
        });
        void error;
      }
    }
  }

  return { landscapeUrl, verticalUrl, shorts };
}
