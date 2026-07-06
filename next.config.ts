import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transformers.js pulls in the native onnxruntime-node addon; keep it out of
  // the server bundle and let Node require it directly.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
