import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import { getPlatformLocale } from "@/lib/i18n/server";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "ProMedia Events",
    template: "%s — ProMedia Events",
  },
  description: "Event registration and check-in.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The platform locale is a reasonable default for the document
  // language, but this is a root layout shared by every route,
  // including public event pages whose *actual* content language
  // depends on that event's own event_language (§4) and can differ
  // from the viewer's platform cookie. Getting `lang` exactly right on
  // every page would need a per-page override this layout can't see —
  // documented as a known imperfection rather than solved here.
  const locale = await getPlatformLocale();

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
