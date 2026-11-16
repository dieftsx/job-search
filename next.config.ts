import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Playwright precisa rodar fora do bundle do Next.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
