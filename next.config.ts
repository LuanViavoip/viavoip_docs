import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Envio de documentação pelo importador (limite real: MAX_UPLOAD_BYTES = 50 MB) + folga do multipart.
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
