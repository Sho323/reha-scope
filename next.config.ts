import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: true,
  // mediapipe (24MB) とスクリーン画像をプリキャッシュから除外
  publicExcludes: ['!mediapipe/**', '!screen*.png'],
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    // woff2フォント全件とmapファイルをプリキャッシュから除外
    // （フォントはHTTPキャッシュが担当、mediapipeはruntimeCachingで遅延キャッシュ）
    exclude: [
      /\.woff2$/,
      /\.map$/,
      /^manifest.*\.js$/,
    ],
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'navigation-cache',
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\/mediapipe\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mediapipe-cache',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
})

const nextConfig: NextConfig = {
  output: 'export',
  turbopack: {},
}

export default withPWA(nextConfig)
