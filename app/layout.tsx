import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
      // No scroll-snap on the document. We've tried `proximity` twice
      // hoping the OS would only soft-snap on slow settles, but in
      // practice (verified on iOS Safari) any snap config makes the
      // momentum engine soft-brake toward snap points — momentum-fling
      // gets clipped, scrolling feels heavy. Section alignment is the
      // sacrifice; first-class iOS momentum is the priority. Tab clicks
      // land on the right section via window.scrollTo regardless.
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground">
        {/* Dark by default — the dashboard is designed for at-a-glance
            ambient viewing (kitchen iPad, late-evening phone glance), and
            the gradient cards + live cam frames read more naturally on a
            dark surface. `enableSystem` is still on, so a user who has
            already picked light/dark in next-themes' storage keeps it. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
        {/* Vercel Web Analytics. Auto-tracks pageviews + receives
            track() calls fired from interactive components (tab switch,
            cam pick, PTR, translate). Cookie-less, no consent banner
            needed. View at vercel.com/<team>/<project>/analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
