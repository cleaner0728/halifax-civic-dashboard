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
      // Restore scroll-snap on the document, but with `proximity` +
      // (implicit) `scroll-snap-stop: normal`. That combination gives us
      // both behaviors:
      //   - Fast flicks pass through multiple snap points freely, so iOS
      //     Safari's UIScrollView momentum runs at full speed.
      //   - Slow scrolls that settle near a section boundary get a soft
      //     snap to align the section with the viewport top.
      // Earlier we'd removed snap entirely chasing maximum momentum;
      // `proximity` turns out to be the right middle ground.
      className={`${geistSans.variable} ${geistMono.variable} snap-y snap-proximity antialiased`}
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
      </body>
    </html>
  );
}
