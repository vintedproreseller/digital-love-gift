/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raise the request body limit for image uploads (App Router)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
