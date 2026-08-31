import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground">
            FC
          </span>
          <span className="font-display text-lg tracking-[0.18em]">FACELESSCUT</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/studio" className="hover:text-foreground">
            Studio
          </Link>
          <Link href="/studio" className="hidden sm:inline hover:text-foreground">
            New cut
          </Link>
        </nav>
      </div>
    </header>
  );
}
