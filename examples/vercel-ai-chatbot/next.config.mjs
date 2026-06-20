/** @type {import("next").NextConfig} */
const serverNativePackages = [
  "turbomem",
  "@turbomem/vercel-ai",
  "@electric-sql/pglite",
  "@huggingface/transformers",
  "onnxruntime-node",
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: serverNativePackages,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), ...serverNativePackages];
    }
    return config;
  },
};

export default nextConfig;
