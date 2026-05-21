import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Global News – Halifax Dashboard",
  description: "Live news feed and weather for Halifax, Nova Scotia",
  appleWebApp: {
    capable: true,
    title: "Halifax",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // `snap-y snap-proximity` configures the document scroller for snap
      // behavior — scroll-snap-type must live on the actual scrolling
      // element, which (now that ScrollSnapContainer no longer uses a
      // nested overflow:auto div) is <html>/<body>.
      // We drop the old `h-full` so the document grows with content
      // instead of being constrained to viewport height.
      className={`${geistSans.variable} ${geistMono.variable} snap-y snap-proximity antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
