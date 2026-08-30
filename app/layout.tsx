import type { Metadata } from "next";
import { IBM_Plex_Sans, Syne } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const display = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "FacelessCut — clean YouTube cuts for faceless channels",
  description:
    "Upload a faceless clip. Get a clean YouTube cut with hook, chapters, and captions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 film-grain opacity-30 mix-blend-overlay" />
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
