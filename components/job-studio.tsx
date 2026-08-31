"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  Merge,
  Scissors,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedJob } from "@/lib/serialize";
import type { Section } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { formatTimecode } from "@/lib/utils-client";

const STEPS = [
  ["uploading", "Uploading"],
  ["transcribing", "Transcribing"],
  ["cleaning", "Cleaning"],
  ["segregating", "Segregating"],
  ["writing", "Writing hook"],
  ["rendering", "Rendering"],
  ["ready", "Ready"],
] as const;

function stepIndex(status: string): number {
  const index = STEPS.findIndex(([id]) => id === status);
  return index === -1 ? (status === "failed" ? -1 : 0) : index;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function JobStudio({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<SerializedJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hookText, setHookText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const editingRef = useRef(false);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const payload = (await response.json()) as SerializedJob & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Job not found");
        }
        if (cancelled) return;
        setJob(payload);
        setError(null);
        const statusChanged = lastStatus.current !== payload.status;
        lastStatus.current = payload.status;
        if (!editingRef.current || statusChanged) {
          setHookText(payload.hookText ?? "");
          setTitle(payload.youtubeTitle ?? "");
          setDescription(payload.youtubeDescription ?? "");
          setSections(payload.sections ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load job");
        }
      }
    }
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId]);

  const active = job ? stepIndex(job.status) : 0;
  const inFlight = job ? !["ready", "failed"].includes(job.status) : true;

  const chapterCopy = useMemo(() => {
    return sections
      .map((section) => `${formatTimecode(section.start)} ${section.title}`)
      .join("\n");
  }, [sections]);

  async function persist(next?: Partial<SerializedJob> & { sectionsJson?: Section[] }) {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hookText,
        youtubeTitle: title,
        youtubeDescription: description,
        sectionsJson: next?.sectionsJson ?? sections,
      }),
    });
  }

  async function runAction(kind: "rerun" | "rerender" | "retry") {
    setBusy(kind);
    try {
      await persist();
      const path = kind === "rerender" ? "rerender" : "rerun";
      const response = await fetch(`/api/jobs/${jobId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "rerender"
            ? { hookText, youtubeTitle: title, youtubeDescription: description, sectionsJson: sections }
            : {},
        ),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Action failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  function markCopied(key: string) {
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function updateSection(id: string, patch: Partial<Section>) {
    setSections((current) => current.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function mergeSection(index: number) {
    setSections((current) => {
      if (index >= current.length - 1) return current;
      const first = current[index];
      const next = current[index + 1];
      const merged: Section = {
        ...first,
        end: next.end,
        text: `${first.text} ${next.text}`.trim(),
        title: first.title,
      };
      return [...current.slice(0, index), merged, ...current.slice(index + 2)];
    });
  }

  function splitSection(index: number) {
    setSections((current) => {
      const section = current[index];
      const mid = section.start + (section.end - section.start) / 2;
      const words = section.text.split(/\s+/);
      const left: Section = {
        ...section,
        end: mid,
        title: section.title,
        text: words.slice(0, Math.ceil(words.length / 2)).join(" "),
        id: `${section.id}-a`,
      };
      const right: Section = {
        ...section,
        id: `${section.id}-b`,
        start: mid,
        title: `${section.title} B`,
        text: words.slice(Math.ceil(words.length / 2)).join(" "),
        type: section.type === "hook" ? "body" : section.type,
      };
      return [...current.slice(0, index), left, right, ...current.slice(index + 1)];
    });
  }

  if (error && !job) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <h1 className="font-display text-3xl">This cut is gone</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Button asChild className="mt-6">
          <Link href="/studio">Back to studio</Link>
        </Button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center text-muted-foreground">
        <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading cut…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-20 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Job</p>
          <h1 className="mt-1 font-display text-4xl">The cut desk</h1>
        </div>
        <Badge variant={job.status === "failed" ? "outline" : "default"}>{job.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
        {STEPS.map(([id, label], index) => {
          const done = active > index || job.status === "ready";
          const current = job.status === id;
          return (
            <div
              key={id}
              className={`rounded-lg border px-3 py-3 ${
                current ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                0{index + 1}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                {done ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                {current && inFlight ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {job.status === "failed" ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{job.error || "The pipeline failed."}</p>
            <Button onClick={() => void runAction("retry")} disabled={busy !== null}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {job.stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Before" value={formatDuration(job.stats.originalSec)} />
          <Stat label="After" value={formatDuration(job.stats.cleanSec)} />
          <Stat label="Silence removed" value={formatDuration(job.stats.silenceSec)} />
          <Stat
            label="Fillers / repeats"
            value={`${job.stats.fillerCount} / ${job.stats.repeatCount}`}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Stats appear after cleanup. The mock pipeline writes a fake 40s transcript with um / uh,
            repeats, and dead air.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>16:9</CardTitle>
          </CardHeader>
          <CardContent>
            {job.outputLandscapeUrl ? (
              <video src={job.outputLandscapeUrl} controls className="aspect-video w-full rounded-lg bg-black" />
            ) : (
              <EmptyPlayer label={inFlight ? "Rendering landscape…" : "No 16:9 output"} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>9:16</CardTitle>
          </CardHeader>
          <CardContent>
            {job.outputVerticalUrl ? (
              <video
                src={job.outputVerticalUrl}
                controls
                className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-lg bg-black"
              />
            ) : (
              <EmptyPlayer label={inFlight ? "Rendering vertical…" : "No 9:16 output"} tall />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Packaging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="hook">Hook</Label>
            <Input
              id="hook"
              className="mt-2"
              value={hookText}
              onFocus={() => {
                editingRef.current = true;
              }}
              onChange={(event) => setHookText(event.target.value)}
              onBlur={() => {
                editingRef.current = false;
                void persist();
              }}
            />
          </div>
          <div>
            <Label htmlFor="title">YouTube title</Label>
            <Input
              id="title"
              className="mt-2"
              value={title}
              onFocus={() => {
                editingRef.current = true;
              }}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                editingRef.current = false;
                void persist();
              }}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              className="mt-2 min-h-[180px]"
              value={description}
              onFocus={() => {
                editingRef.current = true;
              }}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => {
                editingRef.current = false;
                void persist();
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void copyText(title);
                markCopied("title");
              }}
            >
              <Copy className="h-4 w-4" />
              {copied === "title" ? "Copied title" : "Copy title"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void copyText(description);
                markCopied("desc");
              }}
            >
              <Copy className="h-4 w-4" />
              {copied === "desc" ? "Copied description" : "Copy description"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void copyText(chapterCopy);
                markCopied("chapters");
              }}
            >
              <Copy className="h-4 w-4" />
              {copied === "chapters" ? "Copied chapters" : "Copy chapters"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sections land after segregation. Hook first, body next, CTA last if it sounds like a close.
            </p>
          ) : (
            sections.map((section, index) => (
              <div key={section.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary">{section.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatTimecode(section.start)}–{formatTimecode(section.end)} ·{" "}
                    {formatDuration(section.end - section.start)}
                  </span>
                </div>
                <Input
                  className="mt-3"
                  value={section.title}
                  aria-label={`Rename ${section.title}`}
                  onChange={(event) => updateSection(section.id, { title: event.target.value })}
                  onBlur={() => void persist()}
                />
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{section.text}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${section.id}-long`}
                      checked={section.includeInLongVideo}
                      onCheckedChange={(checked) =>
                        updateSection(section.id, { includeInLongVideo: checked })
                      }
                      aria-label="Include in long video"
                    />
                    <Label htmlFor={`${section.id}-long`}>Include in long video</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${section.id}-short`}
                      checked={section.includeAsShort}
                      onCheckedChange={(checked) =>
                        updateSection(section.id, { includeAsShort: checked })
                      }
                      aria-label="Render as short"
                    />
                    <Label htmlFor={`${section.id}-short`}>Render as Short</Label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => mergeSection(index)}>
                    <Merge className="h-3.5 w-3.5" />
                    Merge with next
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => splitSection(index)}>
                    <Scissors className="h-3.5 w-3.5" />
                    Split
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void runAction("rerun")} disabled={busy !== null || !job.words.length}>
          Re-run cleanup
        </Button>
        <Button
          variant="outline"
          onClick={() => void runAction("rerender")}
          disabled={busy !== null || !job.remappedWords.length}
        >
          Re-render overlays
        </Button>
        {job.outputLandscapeUrl ? (
          <Button asChild>
            <a href={job.outputLandscapeUrl} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Download 16:9
            </a>
          </Button>
        ) : null}
        {job.outputVerticalUrl ? (
          <Button asChild>
            <a href={job.outputVerticalUrl} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Download 9:16
            </a>
          </Button>
        ) : null}
        {job.shorts
          .filter((item) => item.url)
          .map((item) => (
            <Button key={item.sectionId} asChild variant="secondary">
              <a href={item.url ?? ""} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
                {item.title}
              </a>
            </Button>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyPlayer({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-border bg-black/30 text-sm text-muted-foreground ${
        tall ? "mx-auto aspect-[9/16] max-w-[280px]" : "aspect-video"
      }`}
    >
      {label}
    </div>
  );
}
