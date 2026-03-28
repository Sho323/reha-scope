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
    // フォント(7.6MB×131ファイル)・mapファイル・manifest.jsをプリキャッシュから除外
    // フォントはSWインストール時ではなく初回アクセス時にruntimeCachingでキャッシュする
    // → SWインストールを軽量化してモバイルでのインストール成功率を大幅に向上させる
    // 注意: workbox-webpack-plugin の exclude は asset.name（先頭 / なし）でマッチする
    exclude: [
      /\.map$/,
      /^manifest.*\.js$/,
      /\.woff2$/,  // 全woff2フォントをプリキャッシュから除外（runtimeCachingで対応）
    ],
    // 4つのHTMLページのみ明示的にプリキャッシュ
    // JSチャンク(1.3MB)・CSS(160KB)はworkboxが自動でプリキャッシュ
    // MediaPipe(24MB)はプリキャッシュに含めない→runtimeCachingで初回アクセス時にキャッシュ
    additionalManifestEntries: [
      { url: '/',         revision: buildRevision },
      { url: '/home',     revision: buildRevision },
      { url: '/input',    revision: buildRevision },
      { url: '/analysis', revision: buildRevision },
    ],
    // プリキャッシュにマッチしないナビゲーションリクエストへのフォールバック
    navigateFallback: '/',
    navigateFallbackDenylist: [
      /^\/_next\//,
      /\/mediapipe\//,
      /\.[a-zA-Z0-9]{1,5}$/,
    ],
    runtimeCaching: [
      {
        // Next.js静的メディア（フォント・画像）: CacheFirst
        // プリキャッシュから除外した分をランタイムでキャッシュ
        urlPattern: /\/_next\/static\/media\//i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-media-cache',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        // MediaPipe WASMモデル（大容量）: CacheFirstでオフライン確実対応
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
