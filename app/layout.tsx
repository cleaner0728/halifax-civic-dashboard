import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import GoogleTranslateMount from "@/components/GoogleTranslateMount";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Made in Halifax",
  description: "Live news feed and weather for Halifax, Nova Scotia",
  appleWebApp: {
    capable: true,
    title: "Made in Halifax",
    // "default" renders a light/white status bar with dark text — jarring
    // against the dark dashboard when launched from the iOS home screen.
    // "black" gives a dark bar with light glyphs that blends into the
    // near-black background. (Content still starts below the status bar, so
    // no safe-area work is needed.)
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  // Match the page background in each scheme so Safari's browser chrome (and
  // the PWA splash) blend with the app instead of showing a bright accent.
  // Values mirror --background in globals.css (light #eceef2 / dark #0b1120).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
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
        {/* Pre-paint viewport tag. Runs before first paint (like the theme
            script) so CSS can hide the mobile tree on wide screens before the
            desktop shell mounts — preventing a flash of the phone layout on
            desktop. Sets data-vw="mobile" on phones, which changes nothing. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{document.documentElement.dataset.vw=window.matchMedia('(min-width:1280px)').matches?'desktop':'mobile';}catch(e){document.documentElement.dataset.vw='mobile';}})();",
          }}
        />
        {/* Dark by default — the dashboard is designed for at-a-glance
            ambient viewing (kitchen iPad, late-evening phone glance), and
            the gradient cards + live cam frames read more naturally on a
            dark surface. `enableSystem` is still on, so a user who has
            already picked light/dark in next-themes' storage keeps it. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          themes={["light", "dark", "halifax"]}
        >
          {children}
          <GoogleTranslateMount />
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
