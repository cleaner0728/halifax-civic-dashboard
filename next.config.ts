import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    // News images come from a handful of trusted RSS sources. Listing hosts
    // explicitly so a future feed swap doesn't silently start optimizing
    // arbitrary URLs.
    remotePatterns: [
      { protocol: "https", hostname: "**.cbc.ca" },
      { protocol: "https", hostname: "globalnews.ca" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "**.halifaxexaminer.ca" },
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "cdn.halifax.ca" },
      { protocol: "https", hostname: "images.novascotiawebcams.com" },
      // Halifax Harbour Bridges traffic cams. Proxied through next/image to
      // avoid Chrome's ORB silently dropping the cross-origin response (the
      // same problem the Emera Oval cam hit on cdn.halifax.ca).
      { protocol: "https", hostname: "halifaxharbourbridges.ca" },
    ],
  },
};

export default nextConfig;
