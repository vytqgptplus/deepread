/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence the turbopack root warning
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
