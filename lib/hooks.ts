import { env, isMock } from "@/lib/env";
import { mockWriteMetadata } from "@/lib/providers/mock";
import { writeMetadataWithOpenAi } from "@/lib/providers/openai";
import type { HookMetadata, Section, Style } from "@/lib/types";

function chapterLines(sections: Section[]): string {
  return sections
    .map((section) => {
      const total = Math.max(0, Math.floor(section.start));
      const mins = Math.floor(total / 60);
      const secs = String(total % 60).padStart(2, "0");
      return `${mins}:${secs} ${section.title}`;
    })
    .join("\n");
}

export function formatYoutubeDescription(
  description: string,
  sections: Section[],
): string {
  if (/^\d+:\d{2}\s/m.test(description)) return description;
  return `${description.trim()}\n\nChapters\n${chapterLines(sections)}`.trim();
}

export async function writePackaging(input: {
  transcript: string;
  style: Style;
  hookMode: "auto" | "custom";
  customHook?: string | null;
  sections: Section[];
}): Promise<HookMetadata> {
  const customHook = input.hookMode === "custom" ? input.customHook : null;
  const meta =
    isMock() || !env.openaiKey
      ? mockWriteMetadata(input.transcript, input.style, customHook)
      : await writeMetadataWithOpenAi({
          transcript: input.transcript,
          style: input.style,
          customHook,
        });

  return {
    ...meta,
    hook: (customHook?.trim() || meta.hook).toUpperCase(),
    description: formatYoutubeDescription(meta.description, input.sections),
  };
}
