"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Style } from "@/lib/types";

const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_BYTES = 1024 * 1024 * 1024;

const STYLES: Array<{ id: Style; label: string; hint: string }> = [
  { id: "faceless-documentary", label: "Documentary", hint: "Calm authority" },
  { id: "reddit-story", label: "Reddit story", hint: "Nobody expected" },
  { id: "listicle", label: "Listicle", hint: "Number + rule" },
  { id: "finance-calm", label: "Finance calm", hint: "One concrete rule" },
  { id: "horror-story", label: "Horror story", hint: "Incomplete tension" },
];

export function StudioForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>("faceless-documentary");
  const [hookMode, setHookMode] = useState<"auto" | "custom">("auto");
  const [customHook, setCustomHook] = useState("");
  const [outputs, setOutputs] = useState<"landscape" | "vertical" | "both">("both");
  const [splitMode, setSplitMode] = useState<"one" | "chapters" | "shorts">("chapters");
  const [removeSilence, setRemoveSilence] = useState(true);
  const [removeFillers, setRemoveFillers] = useState(true);
  const [removeRepeats, setRemoveRepeats] = useState(true);
  const [silenceMs, setSilenceMs] = useState<250 | 350 | 500>(350);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function takeFile(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      setError("Use an mp4, mov, or webm file.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("Max upload size is 1GB.");
      return;
    }
    setFile(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Drop a clip first.");
      return;
    }

    setBusy(true);
    setError(null);
    setProgress(8);

    try {
      const signedRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const signed = (await signedRes.json()) as {
        uploadUrl?: string;
        key?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!signedRes.ok || !signed.uploadUrl || !signed.key) {
        throw new Error(signed.error || "Could not sign upload");
      }

      setProgress(22);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.uploadUrl as string);
        xhr.setRequestHeader("content-type", file.type);
        xhr.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) return;
          setProgress(22 + Math.round((progressEvent.loaded / progressEvent.total) * 60));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setProgress(88);
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceKey: signed.key,
          sourceUrl: signed.publicUrl,
          style,
          hookMode,
          customHook: hookMode === "custom" ? customHook : null,
          outputs,
          splitMode,
          silenceMs: removeSilence ? silenceMs : 500,
          removeFillers,
          removeRepeats,
        }),
      });
      const job = (await jobRes.json()) as { id?: string; error?: string };
      if (!jobRes.ok || !job.id) {
        throw new Error(job.error || "Could not create job");
      }
      setProgress(100);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Source clip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              takeFile(event.dataTransfer.files[0]);
            }}
            className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/40"
            }`}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              onChange={(event) => takeFile(event.target.files?.[0])}
            />
            <Upload className="mb-3 h-8 w-8 text-primary" />
            <p className="font-display text-2xl">Drop an mp4 / mov / webm</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Stock + voiceover already mixed, or a raw VO take. Max 1GB.
            </p>
            {file ? (
              <Badge className="mt-4">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            ) : null}
          </label>
          {preview ? (
            <video src={preview} controls className="w-full rounded-lg bg-black" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-black/40 text-muted-foreground">
              <Film className="mr-2 h-4 w-4" />
              Preview appears after you choose a file
            </div>
          )}
          {busy ? <Progress value={progress} /> : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cut settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Style</legend>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStyle(item.id)}
                    className={`rounded-lg border px-3 py-3 text-left ${
                      style === item.id ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.hint}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Hook mode</legend>
              <div className="flex gap-2">
                {(["auto", "custom"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={hookMode === mode ? "default" : "outline"}
                    onClick={() => setHookMode(mode)}
                  >
                    {mode === "auto" ? "Auto" : "Custom text"}
                  </Button>
                ))}
              </div>
              {hookMode === "custom" ? (
                <Textarea
                  className="mt-3"
                  value={customHook}
                  onChange={(event) => setCustomHook(event.target.value)}
                  placeholder="THE CUT IS THE HOOK"
                  maxLength={80}
                />
              ) : null}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Outputs</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["landscape", "16:9"],
                    ["vertical", "9:16"],
                    ["both", "Both"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={outputs === value ? "default" : "outline"}
                    onClick={() => setOutputs(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Segregate</legend>
              <div className="grid gap-2">
                {(
                  [
                    ["one", "One clean video"],
                    ["chapters", "One video + chapters"],
                    ["shorts", "Split into Shorts"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={splitMode === value ? "default" : "outline"}
                    onClick={() => setSplitMode(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cleanup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="silence">Remove silence</Label>
              <Switch
                id="silence"
                checked={removeSilence}
                onCheckedChange={setRemoveSilence}
                aria-label="Remove silence"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="fillers">Remove filler words</Label>
              <Switch
                id="fillers"
                checked={removeFillers}
                onCheckedChange={setRemoveFillers}
                aria-label="Remove filler words"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="repeats">Remove repeated words</Label>
              <Switch
                id="repeats"
                checked={removeRepeats}
                onCheckedChange={setRemoveRepeats}
                aria-label="Remove repeated words"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Silence tightness</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    [250, "Tight 250ms"],
                    [350, "Normal 350ms"],
                    [500, "Loose 500ms"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={silenceMs === value ? "default" : "outline"}
                    onClick={() => setSilenceMs(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Sending to the pipeline…" : "Create cut"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
