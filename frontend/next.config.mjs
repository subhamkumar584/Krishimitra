/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  async redirects() {
    return [
      { source: '/', destination: '/auth/login', permanent: false },
    ]
  },
  async rewrites() {
    // Proxy API calls to Flask backend in development to avoid CORS/env issues
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
    ]
  }
}

export default nextConfig
