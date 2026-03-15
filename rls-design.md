# RehaScope - アクセス制御設計書（RLS Design）

**バージョン：** 1.0
**作成日：** 2026-03-15

---

## 1. 概要

RehaScopeはデータベースを持たない完全フロントエンドアプリのため、
従来のDB Row Level Security（RLS）は不要です。
代わりに、以下の「クライアントサイドアクセス制御」を実装します。

---

## 2. アクセス制御方針

| 項目 | 方針 |
|------|------|
| 認証方式 | 職場共通パスワード（環境変数管理） |
| セッション管理 | `sessionStorage`（ブラウザタブを閉じると消える） |
| データ保護 | 動画・分析データはサーバーに送信しない |
| ルートガード | 未認証ユーザーはトップページ（`/`）にリダイレクト |

---

## 3. 認証フロー

```
[ユーザー]
  ↓ アプリにアクセス
[パスワード認証画面（/）]
  ↓ パスワード入力
[クライアント側で環境変数と照合]
  ↓ 一致
[sessionStorage に "reha_auth": "true" を保存]
  ↓
[ホーム画面（/home）へ遷移]

[ユーザー]
  ↓ 直接 /analysis などにアクセス
[ミドルウェア or useEffect でsessionStorage確認]
  ↓ "reha_auth" が存在しない
[/ にリダイレクト]
```

---

## 4. 環境変数設定

```env
# .env.local（ローカル開発用）
NEXT_PUBLIC_APP_PASSWORD=your_workplace_password

# Vercel環境変数（本番用）
# Vercelダッシュボード > Settings > Environment Variables に設定
NEXT_PUBLIC_APP_PASSWORD=your_workplace_password
```

> **注意：** `NEXT_PUBLIC_` プレフィックスはクライアントサイドで参照するために必要です。
> パスワードはコード（Gitリポジトリ）に含めず、必ず環境変数で管理してください。

---

## 5. ルートガード実装

### 5.1 ミドルウェア（middleware.ts）

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ミドルウェアはサーバーサイドのためsessionStorageは使えない
// cookieベースの簡易チェックを使用
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const protectedPaths = ['/home', '/input', '/analysis']

  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (isProtected) {
    const authCookie = request.cookies.get('reha_auth')
    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/home/:path*', '/input/:path*', '/analysis/:path*'],
}
```

### 5.2 パスワード認証コンポーネント

```typescript
// components/PasswordGate.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PasswordGateProps {
  onSuccess: () => void
}

export default function PasswordGate({ onSuccess }: PasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      setError('パスワードを入力してください')
      return
    }

    if (password === process.env.NEXT_PUBLIC_APP_PASSWORD) {
      // セッションストレージ + Cookie に認証フラグ保存
      sessionStorage.setItem('reha_auth', 'true')
      document.cookie = 'reha_auth=true; path=/; SameSite=Strict'
      onSuccess()
      router.push('/home')
    } else {
      setError('パスワードが違います')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-navy-700 mb-6 text-center">
          RehaScope
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              パスワード
            </label>
            <input
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            入室する
          </button>
        </form>
      </div>
    </div>
  )
}
```

### 5.3 クライアントサイドガード（useAuthGuard）

```typescript
// hooks/useAuthGuard.ts
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuthGuard() {
  const router = useRouter()

  useEffect(() => {
    const isAuthed = sessionStorage.getItem('reha_auth')
    if (!isAuthed) {
      router.push('/')
    }
  }, [router])
}
```

---

## 6. データ保護設計

| データ種別 | 保存先 | 送信先 |
|-----------|--------|--------|
| 入力動画（Before/After） | ブラウザメモリ（Blob URL）のみ | なし |
| MediaPipe解析結果 | React State（メモリ）のみ | なし |
| 関節角度データ | React State（メモリ）のみ | なし |
| PDFファイル | 端末ダウンロードのみ | なし |
| CSVファイル | 端末ダウンロードのみ | なし |
| パスワード | 環境変数（Vercel） | なし |
| 認証フラグ | sessionStorage + Cookie | なし |

> **ポイント：** ページを閉じると sessionStorage の認証フラグは消えます。
> 再度アクセスした際はパスワード再入力が必要です（意図的な設計）。

---

## 7. セキュリティ上の注意点

| リスク | 対策 |
|--------|------|
| パスワードのGit流出 | `.env.local` を `.gitignore` に必ず追加 |
| ブラウザキャッシュへのデータ残留 | 動画はBlob URLのみ使用（ページ離脱でGC） |
| パスワードのクライアント公開 | `NEXT_PUBLIC_` は意図的。施設内利用のため許容 |
| 強固な認証が必要になった場合 | NextAuth.js + Supabase Auth への移行を推奨 |
