/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // sql.js uses a .wasm file — tell webpack to handle it
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    if (isServer) {
      config.externals = [...(config.externals || []), 'sql.js'];
    }
    return config;
  },
};

module.exports = nextConfig;
