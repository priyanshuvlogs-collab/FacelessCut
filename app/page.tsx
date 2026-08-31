import Link from "next/link";
import { ArrowRight, Captions, Scissors, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    copy: "Drop a stock/B-roll + VO mix or a raw voice take. No talking-head zooms.",
  },
  {
    icon: Scissors,
    title: "Clean & split",
    copy: "Silence, fillers, and repeats come out. Speech is segregated into Hook / Body / CTA.",
  },
  {
    icon: Captions,
    title: "Download 16:9 + Shorts",
    copy: "Captions burn on the clean timeline. Walk away with a long cut and optional 9:16s.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            Private faceless studio
          </p>
          <h1 className="font-display text-4xl leading-[0.95] sm:text-6xl">
            Upload a faceless clip. Get a clean YouTube cut with hook + captions.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            FacelessCut is an upload → cleanup → segregate → caption/hook → render
            pipeline. It is not a talking-head zoom app and not a text-to-video generator.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/studio">
                Open the studio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/studio">Start with a mock render</Link>
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
          <div className="absolute inset-y-0 left-0 w-5 sprocket" />
          <div className="absolute inset-y-0 right-0 w-5 sprocket" />
          <div className="mx-5 aspect-video overflow-hidden rounded-lg bg-black">
            <div className="flex h-full flex-col justify-between p-5">
              <div className="text-center font-display text-2xl uppercase leading-none text-punch sm:text-3xl">
                The cut is the hook
              </div>
              <div className="mx-auto rounded-md bg-black/60 px-3 py-2 text-center text-sm font-bold uppercase tracking-wide">
                viewers <span className="text-punch">leave</span> before the payoff
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            16:9 + 9:16 · remapped captions · chapters
          </p>
        </div>
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-border bg-card/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <step.icon className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <h2 className="font-display text-2xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
