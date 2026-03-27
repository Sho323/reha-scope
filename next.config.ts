import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

// デプロイのたびに変わるリビジョン
// → workbox がHTMLページを毎回再キャッシュするよう強制する
const buildRevision = String(Date.now())

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
    exclude: [
      /\.woff2$/,
      /\.map$/,
      /^manifest.*\.js$/,
    ],
    // 全ページHTMLを直接プリキャッシュ
    // navigateFallback より確実：precacheAndRoute が URL 完全一致で返す
    additionalManifestEntries: [
      { url: '/',         revision: buildRevision },
      { url: '/home',     revision: buildRevision },
      { url: '/input',    revision: buildRevision },
      { url: '/analysis', revision: buildRevision },
    ],
    runtimeCaching: [
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
