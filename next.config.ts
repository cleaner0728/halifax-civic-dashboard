import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
