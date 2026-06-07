import type { NextConfig } from "next";

// No `images` config — this app does not use next/image anywhere. Every
// `<img>` in the UI is a plain HTML element that fetches its source CDN
// directly, so Vercel Image Optimization is never billed. If anyone later
// adds an `<Image>` import from next/image, the lint rule
// `@next/next/no-img-element` flips meaning (which means CI will surface
// it) and this comment explains why we don't want that.
const nextConfig: NextConfig = {
  devIndicators: false,
};

export default nextConfig;
