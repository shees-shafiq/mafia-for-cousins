/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the backend socket URL in the browser
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
};

module.exports = nextConfig;
