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
    // index.html をプリキャッシュに明示登録（navigateFallback の参照先として必須）
    // revision: null = SWが再インストールされるたびに最新版を取得する
    additionalManifestEntries: [
      { url: '/index.html', revision: null },
    ],
    // オフライン時にナビゲーションが失敗した場合のフォールバック先
    // output: 'export' + 全ページ 'use client' のため、index.html から
    // Next.js クライアントルーターが正しいページを描画する
    navigateFallback: '/index.html',
    // _next/ 静的アセットへのリクエストはフォールバック対象外
    navigateFallbackDenylist: [/^\/_next\//, /^\/api\//],
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
