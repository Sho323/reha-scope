# RehaScope - 手動セットアップ手順書

**バージョン：** 1.0
**作成日：** 2026-03-15
**対象者：** 非エンジニア（コピペで完了できるよう設計）

---

## 前提条件

以下が手元にあることを確認してください：

- [ ] パソコン（Mac または Windows）
- [ ] インターネット接続
- [ ] GitHubアカウント（無料）
- [ ] Vercelアカウント（無料）※GitHubアカウントで登録可能

---

## STEP 1：Node.js のインストール

> すでにインストール済みの場合はスキップ

1. https://nodejs.org にアクセス
2. 「LTS（推奨版）」をダウンロード・インストール
3. インストール後、ターミナル（Mac）またはコマンドプロンプト（Windows）を開き以下を実行：

```bash
node -v
```

`v20.x.x` のように表示されればOKです。

---

## STEP 2：プロジェクトの作成

ターミナルで以下のコマンドをコピー&ペーストして実行してください：

```bash
npx create-next-app@latest reha-scope \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

質問が出たら全て **Enter** を押してください。

作成完了後、プロジェクトフォルダに移動：

```bash
cd reha-scope
```

---

## STEP 3：必要なパッケージのインストール

以下のコマンドをターミナルで実行してください：

```bash
# MediaPipe
npm install @mediapipe/pose @mediapipe/camera_utils @mediapipe/drawing_utils

# PDF生成
npm install jspdf html2canvas

# グラフ
npm install recharts

# PWA
npm install next-pwa

# 型定義
npm install -D @types/jspdf

# テスト
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest jest-environment-jsdom
```

---

## STEP 4：環境変数の設定

プロジェクトフォルダ内に `.env.local` というファイルを作成し、以下を記述してください：

```
NEXT_PUBLIC_APP_PASSWORD=ここに職場のパスワードを入力
```

> **例：** `NEXT_PUBLIC_APP_PASSWORD=rehascope2026`

> ⚠️ このファイルは絶対にGitHubにアップロードしないでください。
> `.gitignore` に `.env.local` が含まれていることを確認してください。

---

## STEP 5：PWA設定

### 5.1 next.config.js の更新

`next.config.js` を以下の内容に書き換えてください：

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // MediaPipe用のヘッダー設定
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
```

### 5.2 manifest.json の作成

`public/manifest.json` を作成し、以下を貼り付けてください：

```json
{
  "name": "RehaScope",
  "short_name": "RehaScope",
  "description": "理学療法士向け動作分析ツール",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#1e3a5f",
  "orientation": "landscape",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 5.3 アイコンの配置

`public/icons/` フォルダを作成し、以下の2サイズのアイコン画像を配置してください：
- `icon-192x192.png`（192×192ピクセル）
- `icon-512x512.png`（512×512ピクセル）

> 無料アイコン生成ツール：https://favicon.io

---

## STEP 6：ローカルで動作確認

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、パスワード入力画面が表示されればOKです。

---

## STEP 7：GitHubにアップロード

### 7.1 GitHubでリポジトリ作成

1. https://github.com にログイン
2. 右上の「+」→「New repository」
3. Repository name：`reha-scope`
4. **Private**（非公開）を選択 ← 重要
5. 「Create repository」をクリック

### 7.2 コードをアップロード

ターミナルで以下を順番に実行：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/reha-scope.git
git push -u origin main
```

> `あなたのユーザー名` は自分のGitHubのユーザー名に変更してください

---

## STEP 8：Vercelにデプロイ

### 8.1 Vercelアカウント作成

1. https://vercel.com にアクセス
2. 「Sign up」→「Continue with GitHub」でGitHubアカウントと連携

### 8.2 プロジェクトのインポート

1. Vercelダッシュボードで「Add New...」→「Project」
2. GitHubのリポジトリ一覧から `reha-scope` を選択
3. 「Import」をクリック

### 8.3 環境変数の設定（重要）

「Configure Project」画面で：
1. 「Environment Variables」セクションを開く
2. 以下を入力：
   - **Name：** `NEXT_PUBLIC_APP_PASSWORD`
   - **Value：** 職場で決めたパスワード
3. 「Add」をクリック

### 8.4 デプロイ実行

「Deploy」ボタンをクリック。
2〜3分後に `https://reha-scope-xxxx.vercel.app` のようなURLが発行されます。

---

## STEP 9：iPadにPWAとしてインストール

1. iPadのSafariでVercelのURLを開く
2. 画面下部の「共有」アイコン（□に↑）をタップ
3. 「ホーム画面に追加」をタップ
4. 「追加」をタップ

ホーム画面にRehaScopeのアイコンが追加され、
次回からはオフラインでも利用できます。

---

## STEP 10：パスワードの変更方法

1. Vercelダッシュボードにログイン
2. プロジェクトを選択 → 「Settings」→「Environment Variables」
3. `NEXT_PUBLIC_APP_PASSWORD` の値を変更
4. 「Save」→ Vercelが自動で再デプロイ（2〜3分）
5. 各端末でブラウザをリロードすれば新しいパスワードが有効になる

---

## トラブルシューティング

| 症状 | 対処法 |
|------|--------|
| `npm run dev` でエラー | `node -v` でNode.js 18以上か確認 |
| MediaPipeが動かない | ChromeまたはSafari最新版を使用しているか確認 |
| カメラが使えない | ブラウザのカメラ許可をONにする |
| オフラインで動かない | 一度オンラインで開いてからオフにする（初回キャッシュが必要） |
| パスワードが効かない | Vercelの環境変数を確認・再デプロイ |
| iPadで画面が崩れる | Safari最新版にアップデート |

---

## サポート

技術的な問題が発生した場合は、以下の情報を添えてお知らせください：
- エラーメッセージの全文（スクリーンショット可）
- 使用デバイスとブラウザのバージョン
- 発生したSTEP番号
