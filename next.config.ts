import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

// デプロイのたびに変わるリビジョン
// → workbox がHTMLページを毎回再キャッシュするよう強制する
const buildRevision = String(Date.now())

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: false,
  // スクリーン画像のみプリキャッシュから除外（mediapipeはadditionalManifestEntriesで明示キャッシュ）
  publicExcludes: ['!screen*.png'],
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    // mapファイルとmanifest.jsのみプリキャッシュから除外
    exclude: [
      /\.map$/,
      /^manifest.*\.js$/,
    ],
    // 全ページHTMLとMediaPipeファイルを明示的にプリキャッシュ
    // → SWインストール時に確実にキャッシュされるためオフライン分析が可能になる
    additionalManifestEntries: [
      // HTMLページのみプリキャッシュ（軽量→SW インストール成功率が高い）
      // MediaPipe(24MB)はプリキャッシュに含めない。SW インストール時に
      // 大容量ダウンロードが発生すると失敗してページすら開けなくなるため。
      // MediaPipe は runtimeCaching(CacheFirst) でオンライン初回アクセス時にキャッシュする。
      { url: '/',         revision: buildRevision },
      { url: '/home',     revision: buildRevision },
      { url: '/input',    revision: buildRevision },
      { url: '/analysis', revision: buildRevision },
    ],
    // プリキャッシュにマッチしないナビゲーションリクエストへのフォールバック
    // → オフライン時に「ページを開けません」エラーを防ぐ
    navigateFallback: '/',
    // _next静的アセット・MediaPipe・拡張子付きファイルはフォールバック対象外
    navigateFallbackDenylist: [
      /^\/_next\//,
      /\/mediapipe\//,
      /\.[a-zA-Z0-9]{1,5}$/,
    ],
    runtimeCaching: [
      {
        // MediaPipe WASMモデル（大容量）: CacheFirstでオフライン確実対応
        urlPattern: /\/mediapipe\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mediapipe-cache',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Next.js が生成するフォントファイル（_next/static/media/*.woff2）
        // CacheFirst: 一度キャッシュしたらオフラインでも利用可能
        urlPattern: /\/_next\/static\/media\/.*\.woff2$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'font-cache',
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
